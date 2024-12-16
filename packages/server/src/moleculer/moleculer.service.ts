import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServiceBroker } from 'moleculer';
import * as fs from 'fs';
import * as path from 'path';

import moleculerConfig from './moleculer.config';

@Injectable()
export class MoleculerService {
  private broker;
  private readonly logger = new Logger(MoleculerService.name);

  constructor(private configService: ConfigService) {
    const transporter = this.configService.get('transporter');
    if (!transporter) {
      console.error('B6_TRANSPORTER env is required.');
      return;
    }
    this.broker = new ServiceBroker({
      ...moleculerConfig,
    });
    this.loadServices();
    this.broker.start();
  }

  loadServices() {
    // @builder6/plugin-tables@0.5.6,@builder6/plugin-pages@0.5.1,
    const plugins = this.configService.get('plugin.services');
    if (plugins) {
      for (const plugin of plugins.split(',')) {
        // 解析 plugin npm 名称和 版本号。例如： @builder6/plugin-tables
        // 检测 npm 包是否存在
        // 检测 npm 包中是否包含 './dist/package.service.ts'
        // 引入此文件，并创建包服务
        this.loadService(plugin);
      }
    }
  }

  loadService(plugin) {
    try {
      // 解析插件名称和版本号
      const match = plugin.match(/^(.*?)(?:@([\d.]+))?$/);
      if (!match) {
        this.logger.warn(`插件格式无效: ${plugin}`);
        return;
      }

      const [, packageName, version] = match;
      this.logger.log(`加载插件: 名称：${packageName}`);

      // 检测 npm 包是否存在
      if (!this.isPackageInstalled(packageName)) {
        this.logger.error(`插件 ${packageName} 未安装，请先安装`);
        return;
      }

      // 检测是否包含指定文件
      const packageServicePath = path.resolve(
        this.getPackagePath(packageName),
        './dist/package.service.js',
      );

      if (!fs.existsSync(packageServicePath)) {
        this.logger.error(
          `插件 ${packageName} 缺少文件: ${packageServicePath}`,
        );
        return;
      }

      // 动态引入并创建服务
      const serviceModule = require(packageServicePath);
      const serviceSchema = serviceModule.default
        ? serviceModule.default
        : serviceModule;
      if (serviceSchema) {
        this.broker.createService(serviceSchema);
        this.logger.log(`插件服务已创建: ${packageName}`);
      }
    } catch (err) {
      this.logger.error(`处理插件 ${plugin} 时出错: ${(err as Error).message}`);
    }
  }

  private isPackageInstalled(packageName: string): boolean {
    try {
      require.resolve(`${packageName}/package.json`);
      return true;
    } catch {
      return false;
    }
  }

  private getPackagePath(packageName: string): string {
    try {
      return path.dirname(require.resolve(`${packageName}/package.json`));
    } catch {
      throw new Error(`无法解析插件路径: ${packageName}`);
    }
  }
}