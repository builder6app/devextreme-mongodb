import { Controller, Get, Param, Res } from '@nestjs/common';
import { MongodbService } from '@/mongodb/mongodb.service';
import { Response } from 'express';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('api/tables/v2/meta/')
export class MetaController {
  constructor(private readonly mongodbService: MongodbService) {}

  @Get('bases/:baseId/tables/:tableId')
  @ApiBearerAuth()
  async getTableMeta(
    @Param('baseId') baseId: string,
    @Param('tableId') tableId: string,
    @Res() res: Response,
  ) {
    try {
      let table = await this.mongodbService.findOne('b6_tables', tableId);
      if (table) {
        table.fields = await this.mongodbService.find(
          'b6_fields',
          { filter: ['table_id', '=', tableId] },
          {},
        );
      } else {
        table = {
          _id: tableId,
          base_id: baseId,
          name: 'Tasks',
          description: 'I was changed!',
          fields: [
            { _id: 'fld001', name: 'Name', type: 'text' },
            { _id: 'fld002', name: 'Company', type: 'text' },
            { _id: 'fld003', name: 'Age', type: 'number' },
            { _id: 'fld004', name: 'Created', type: 'datetime' },
            { _id: 'fld005', name: 'valid', type: 'boolean' },
          ],
        } as any;
      }
      res.status(200).send(table);
    } catch (error) {
      console.error('Query error', error);
      res.status(500).send(error);
    }
  }
}
