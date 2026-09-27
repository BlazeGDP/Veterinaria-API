import { Controller, Get, Param } from '@nestjs/common';
import { ExternalApiService } from './external-api.service';

@Controller()
export class ExternalController {
  constructor(
    private readonly externalApiService: ExternalApiService,
  ) {}

  @Get('juegos')
  async getJuegos() {
    return this.externalApiService.getJuegos();
  }

  @Get('juegos/:id')
  async getJuegoById(@Param('id') id: string) {
    return this.externalApiService.getJuegoById(id);
  }

  @Get('tareas')
  async getTareas() {
    return this.externalApiService.getTareas();
  }

  @Get('tareas/:id')
  async getTareaById(@Param('id') id: string) {
    return this.externalApiService.getTareaById(id);
  }
}