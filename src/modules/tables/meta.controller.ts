import { Controller, Get, Param, Res, Render } from '@nestjs/common';
import { MetaService } from './meta.service';
import { Response } from 'express';

@Controller('tables/v2/meta/')
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @Get('bases/:baseId/tables/:tableId')
  async getTableMeta(
    @Param('baseId') baseId: string,
    @Param('tableId') tableId: string,
    @Res() res: Response,
  ) {
    try {
      const tableMeta = await this.metaService.getTableMeta(baseId, tableId);
      res.status(200).send(tableMeta);
    } catch (error) {
      console.error('Query error', error);
      res.status(500).send(error);
    }
  }
}