import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsObject()
  payload: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  simulateFailure?: boolean;
}