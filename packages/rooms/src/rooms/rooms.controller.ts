import { AuthGuard } from '@builder6/core';
import { RoomsService } from './rooms.service';
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  Put,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RoomsGuard } from './rooms.guard';
import * as rawBody from 'raw-body';
import { Request } from 'express';
import { FilesService } from '@builder6/core';
import { RoomsGateway } from './rooms.gateway';
import { ServerMsgCode } from './protocol/ServerMsg';

@Controller('v2/c/')
export class RoomsController {
  constructor(
    private roomsService: RoomsService,
    private filesService: FilesService,
    private jwtService: JwtService,
    private roomsGateway: RoomsGateway,
  ) {}

  @UseGuards(AuthGuard)
  @Post('auth')
  async getAuthToken(@Body() body: { room: string }, @Req() req: Request) {
    const user = req['user'];
    const { room = 'undefined' } = body;
    const payload = {
      k: 'acc',
      pid: user.space,
      sid: user.space,
      uid: user.user,
      mcpr: 10,
      perms: {},
      jti: 'S4EMiESTDe6k',
    };
    payload.perms[room] = ['room:write', 'comments:write'];
    const token = await this.jwtService.signAsync(payload);
    return { token };
  }

  @UseGuards(RoomsGuard)
  @Get('users')
  async getUsers(@Query('userIds') userIds: string | string[]) {
    const users = await this.roomsService.getUsers(userIds);
    return users;
  }

  @UseGuards(RoomsGuard)
  @Get('users/search')
  async searchUsers(
    @Req() req: Request,
    @Query('keyword') keyword: string,
    @Query('roomdId') roomdId: string,
  ) {
    const spaceId = req['jwt'].sid;
    const users = await this.roomsService.searchUsers(
      spaceId,
      keyword,
      roomdId,
    );
    return users;
  }

  @UseGuards(RoomsGuard)
  @Get('rooms/:roomId/threads')
  async getThreads(@Param('roomId') roomId: string) {
    const threads = await this.roomsService.getThreads(roomId);
    return {
      data: threads,
      inboxNotifications: [],
      meta: {
        nextCursor: null,
        requestedAt: new Date().toISOString() as string,
        permissionHints: {
          [roomId]: ['room:write'],
        },
      },
      deletedThreads: [],
      deletedInboxNotifications: [],
    };
  }

  @UseGuards(RoomsGuard)
  @Get('rooms/:roomId/threads/delta')
  async getThreadsDelta(
    @Param('roomId') roomId: string,
    @Query('since') since: string,
  ) {
    const sinceDate = new Date(since);
    const threads = await this.roomsService.getThreads(roomId, sinceDate);
    return {
      data: threads,
      inboxNotifications: [],
      meta: {
        nextCursor: null,
        requestedAt: new Date().toISOString() as string,
        permissionHints: {
          [roomId]: ['room:write'],
        },
      },
      deletedThreads: [],
      deletedInboxNotifications: [],
    };
  }

  @UseGuards(RoomsGuard)
  @Post('rooms/:roomId/threads')
  async createThread(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Body() record: Record<string, any>,
  ) {
    const userId = req['jwt'].uid;
    const newThread = await this.roomsService.createThread({
      id: record.id,
      comment: record.comment,
      roomId,
      userId,
      metadata: {},
      resolved: false,
    });

    this.roomsGateway.broadcastToRoom(roomId, {
      type: ServerMsgCode.THREAD_CREATED, // 使用 ServerMsgCode 枚举
      threadId: record.id,
    });

    this.roomsGateway.broadcastToRoom(roomId, {
      type: ServerMsgCode.COMMENT_CREATED, // 使用 ServerMsgCode 枚举
      threadId: record.id,
      commentId: record.comment.id,
    });
    return newThread;
  }

  @UseGuards(RoomsGuard)
  @Get('rooms/:roomId/thread-with-notification/:threadId')
  async threadWithNotification(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Param('threadId') threadId: string,
  ) {
    const thread = await this.roomsService.getThread(roomId, threadId);
    return { thread };
  }

  @UseGuards(RoomsGuard)
  @Post('rooms/:roomId/threads/:threadId/mark-as-resolved')
  async threadMarkasResolved(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Param('threadId') threadId: string,
  ) {
    const newThread = await this.roomsService.updateThread(threadId, {
      resolved: true,
    });

    this.roomsGateway.broadcastToRoom(roomId, {
      type: ServerMsgCode.THREAD_UPDATED, // 使用 ServerMsgCode 枚举
      threadId: threadId,
    });
    return newThread;
  }

  @UseGuards(RoomsGuard)
  @Post('rooms/:roomId/threads/:threadId/mark-as-unresolved')
  async threadMarkasUnResolved(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Param('threadId') threadId: string,
  ) {
    const newThread = await this.roomsService.updateThread(threadId, {
      resolved: false,
    });

    this.roomsGateway.broadcastToRoom(roomId, {
      type: ServerMsgCode.THREAD_UPDATED, // 使用 ServerMsgCode 枚举
      threadId: threadId,
    });
    return newThread;
  }

  // 创建回复
  @UseGuards(RoomsGuard)
  @Post('rooms/:roomId/threads/:threadId/comments')
  async createComment(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Param('threadId') threadId: string,
    @Body() record: Record<string, any>,
  ) {
    const userId = req['jwt'].uid;
    const newComment = await this.roomsService.createComment({
      id: record.id,
      attachmentIds: record.attachmentIds,
      body: record.body,
      roomId,
      threadId: threadId,
      userId: userId,
    });

    await this.roomsService.updateThread(threadId);
    this.roomsGateway.broadcastToRoom(roomId, {
      type: ServerMsgCode.COMMENT_CREATED, // 使用 ServerMsgCode 枚举
      threadId: threadId,
      commentId: record.id,
    });
    return newComment;
  }

  // 编辑回复
  @UseGuards(RoomsGuard)
  @Post('rooms/:roomId/threads/:threadId/comments/:commentId')
  async updateComment(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Param('threadId') threadId: string,
    @Param('commentId') commentId: string,
    @Body() record: Record<string, any>,
  ) {
    const userId = req['jwt'].uid;
    const newComment = await this.roomsService.updateComment(commentId, {
      attachmentIds: record.attachmentIds,
      body: record.body,
      userId,
    });

    await this.roomsService.updateThread(threadId);
    this.roomsGateway.broadcastToRoom(roomId, {
      type: ServerMsgCode.COMMENT_EDITED, // 使用 ServerMsgCode 枚举
      threadId: threadId,
      commentId: commentId,
    });
    return newComment;
  }

  // 删除回复
  @UseGuards(RoomsGuard)
  @Delete('rooms/:roomId/threads/:threadId/comments/:commentId')
  async deleteComment(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Param('threadId') threadId: string,
    @Param('commentId') commentId: string,
  ) {
    await this.roomsService.deleteComment(commentId);

    await this.roomsService.updateThread(threadId);
    this.roomsGateway.broadcastToRoom(roomId, {
      type: ServerMsgCode.COMMENT_DELETED, // 使用 ServerMsgCode 枚举
      threadId: threadId,
      commentId: commentId,
    });
    return {};
  }

  // 获取下载Url
  @Post('rooms/:roomId/attachments/presigned-urls')
  async presignedUrls(@Body('attachmentIds') attachmentIds: string[]) {
    const urls = await Promise.all(
      attachmentIds.map(async (attachmentId) => {
        return this.filesService.getPreSignedUrl(
          'cfs.files.filerecord',
          attachmentId,
        );
      }),
    );
    return { urls };
  }

  // 上传文件
  @Put('rooms/:roomId/attachments/:attachmentId/upload/:fileName')
  async uploadFile(
    @Param('roomId') roomId: string,
    @Param('attachmentId') attachmentId: string,
    @Param('fileName') fileName: string,
    @Query('fileSize') fileSize: number,
    @Req() req: Request,
  ) {
    // 检查 content-type 是否为 application/octet-stream
    if (req.headers['content-type'] !== 'application/octet-stream') {
      throw new HttpException('Invalid content type', HttpStatus.BAD_REQUEST);
    }

    const fileBuffer = await rawBody(req);

    // 构造类似 Express.Multer.File 的对象
    const file = {
      buffer: fileBuffer,
      originalname: fileName,
      size: fileSize,
    };

    const metadata = {
      _id: attachmentId,
      objectName: 'b6_rooms',
      recordId: roomId,
    };

    if (!file) {
      throw new Error('未找到上传的文件');
    }
    const fileRecord = await this.filesService.uploadFile(
      'cfs.files.filerecord',
      file,
      metadata,
    );
    return fileRecord;
  }

  // 创建Reaction
  @UseGuards(RoomsGuard)
  @Post('rooms/:roomId/threads/:threadId/comments/:commentId/reactions')
  async createReaction(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Param('threadId') threadId: string,
    @Param('commentId') commentId: string,
    @Body('emoji') emoji: string,
  ) {
    const userId = req['jwt'].uid;
    const newComment = await this.roomsService.createReaction(commentId, {
      userId: userId,
      emoji: emoji,
    });

    await this.roomsService.updateThread(threadId);
    this.roomsGateway.broadcastToRoom(roomId, {
      type: ServerMsgCode.COMMENT_REACTION_ADDED, // 使用 ServerMsgCode 枚举
      threadId: threadId,
      commentId: commentId,
      emoji: emoji,
    });
    return newComment;
  }

  //删除Reaction
  @UseGuards(RoomsGuard)
  @Delete(
    'rooms/:roomId/threads/:threadId/comments/:commentId/reactions/:emoji',
  )
  async deleteReaction(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Param('threadId') threadId: string,
    @Param('commentId') commentId: string,
    @Param('emoji') emoji: string,
  ) {
    const userId = req['jwt'].uid;
    await this.roomsService.deleteReaction(commentId, { emoji, userId });

    await this.roomsService.updateThread(threadId);
    this.roomsGateway.broadcastToRoom(roomId, {
      type: ServerMsgCode.COMMENT_REACTION_REMOVED, // 使用 ServerMsgCode 枚举
      threadId: threadId,
      commentId: commentId,
      emoji: emoji,
    });
    return {};
  }
}
