/*
 * @LastEditTime: 2024-11-30 22:37:42
 * @LastEditors: liaodaxue
 * @customMade: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { Body, Controller, Get, Post, Req, Res, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiBody } from '@nestjs/swagger';
import { CookieOptions, Request, Response } from 'express';


@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        password: { type: 'string' },
      },
    },
    examples: {
      test: {
        summary: 'test',
        value: {
          username: "test",
          password: "test"
        },
      },
    },
  })
  async login(
    @Req() req: Request,
    @Res() res: Response,
    @Body() signInDto: Record<string, any>
  ) {
    try {
      const result = await this.authService.signIn(signInDto.username, signInDto.password);
      const { user, space, authToken } = result;
      
      const cookieOptions: CookieOptions = {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 2 * 365 * 24 * 60 * 60 * 1000, // maximum expiry 2 years
        secure: process.env.NODE_ENV === 'production', // ensure cookies are sent over HTTPS in production
      };
      
      res.cookie('X-Auth-Token', authToken, cookieOptions);
      res.cookie('X-User-Id', user, cookieOptions);
      res.cookie('X-Space-Id', space, cookieOptions);
      
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error during signIn:', error);
      return res.status(401).json({ message: 'Authentication failed' });
    }  
  }
}