import 'regenerator-runtime/runtime';

import { Injectable } from '@nestjs/common';
import { MongoClient, Db, Collection } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import * as devextremeQuery from 'devextreme-query-mongodb';

@Injectable()
export class RecordsService {
  private db: Db;

  constructor() {
    const client = new MongoClient(process.env.STEEDOS_TABLES_MONGO_URL, {
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });

    client
      .connect()
      .then(() => {
        this.db = client.db();
        console.log('Connected to Tables MongoDB');
      })
      .catch((err) => {
        console.error('Error connecting to Tables MongoDB', err);
      });
  }

  private getCollection(baseId: string, tableId: string): Collection {
    const collectionName = `t_${baseId}_${tableId}`;
    return this.db.collection(collectionName);
  }

  async createRecord(baseId: string, tableId: string, data: any) {
    const collection = this.getCollection(baseId, tableId);
    const entry = { _id: uuidv4(), ...data };
    await collection.insertOne(entry);
    return entry;
  }

  async getRecords(
    baseId: string,
    tableId: string,
    loadOptions: any,
    processingOptions: any,
  ) {
    const collection = this.getCollection(baseId, tableId);

    return devextremeQuery(collection, loadOptions, processingOptions);
  }

  async getRecordById(baseId: string, tableId: string, id: string) {
    const collection = this.getCollection(baseId, tableId);
    return await collection.findOne({ _id: id as any });
  }

  async updateRecord(baseId: string, tableId: string, id: string, data: any) {
    const collection = this.getCollection(baseId, tableId);
    const result = await collection.findOneAndUpdate(
      { _id: id as any },
      { $set: data },
      { returnDocument: 'after' },
    );
    return result.value;
  }

  async deleteOne(baseId: string, tableId: string, query: object) {
    const collection = this.getCollection(baseId, tableId);
    const result = await collection.deleteOne(query);
    return result;
  }

  async deleteMany(baseId: string, tableId: string, query: object) {
    const collection = this.getCollection(baseId, tableId);
    const result = await collection.deleteMany(query);
    return result;
  }
}
