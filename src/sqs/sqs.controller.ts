import { Body, Controller, Post } from '@nestjs/common';
import { SendMessageDto } from './dto/send-message.dto';
import { SqsService } from './sqs.service';

@Controller('sqs')
export class SqsController {
  constructor(private readonly sqsService: SqsService) {}

  @Post('messages')
  async sendMessage(@Body() dto: SendMessageDto) {
    return this.sqsService.sendMessage(dto);
  }
}