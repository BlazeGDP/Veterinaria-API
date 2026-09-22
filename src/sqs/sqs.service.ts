import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SendMessageDto } from './dto/send-message.dto';

interface SqsMessagePayload {
  type: string;
  payload: Record<string, unknown>;
  simulateFailure?: boolean;
}

@Injectable()
export class SqsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SqsService.name);

  private readonly sqsClient: SQSClient;

  private readonly queueUrl =
    process.env.SQS_QUEUE_URL ||
    'https://sqs.us-east-2.amazonaws.com/634197800511/veterinaria-api-queue';

  private isPolling = true;

  constructor() {
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION || 'us-east-2',
    });
  }

  async onModuleInit() {
    this.logger.log('SQS consumer iniciado');

    this.pollMessages();
  }

  async onModuleDestroy() {
    this.isPolling = false;

    this.logger.log('SQS consumer detenido');

    this.sqsClient.destroy();
  }

  async sendMessage(dto: SendMessageDto) {
    const messageBody: SqsMessagePayload = {
      type: dto.type,
      payload: dto.payload,
      simulateFailure: dto.simulateFailure,
    };

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(messageBody),
    });

    const response = await this.sqsClient.send(command);

    this.logger.log(
      `Mensaje enviado a SQS. MessageId: ${response.MessageId}`,
    );

    return {
      messageId: response.MessageId,
      queue: this.queueUrl,
    };
  }

  private async pollMessages(): Promise<void> {
    while (this.isPolling) {
      try {
        const command = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 10,
          VisibilityTimeout: 30,
        });

        const response = await this.sqsClient.send(command);

        if (!response.Messages || response.Messages.length === 0) {
          continue;
        }

        for (const message of response.Messages) {
          await this.processMessage(message);
        }
      } catch (error) {
        this.logger.error(
          `Error consultando SQS: ${error instanceof Error ? error.message : error}`,
        );

        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async processMessage(message: {
    Body?: string;
    ReceiptHandle?: string;
    MessageId?: string;
  }): Promise<void> {
    try {
      this.logger.log(
        `Mensaje recibido. MessageId: ${message.MessageId}`,
      );

      if (!message.Body || !message.ReceiptHandle) {
        throw new Error('Mensaje SQS inválido');
      }

      const data: SqsMessagePayload = JSON.parse(message.Body);

      this.logger.log(`Procesando mensaje tipo: ${data.type}`);

      if (data.simulateFailure === true) {
        throw new Error('Fallo simulado para probar reintentos y DLQ');
      }

      this.logger.log(
        `Mensaje procesado correctamente. MessageId: ${message.MessageId}`,
      );

      await this.sqsClient.send(
        new DeleteMessageCommand({
          QueueUrl: this.queueUrl,
          ReceiptHandle: message.ReceiptHandle,
        }),
      );

      this.logger.log(
        `Mensaje eliminado de SQS. MessageId: ${message.MessageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error procesando mensaje ${message.MessageId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}