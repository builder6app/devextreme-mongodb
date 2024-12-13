import { Controller, Get, UseGuards, Req, Res, Param, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import { Issuer, Client } from 'openid-client';

import { OidcService } from './oidc.service';

@Controller('api/v6/oidc')
export class OidcController {
  constructor(private readonly oidcService: OidcService) {}

  @Get(':providerId/login')
  async login(
    @Param('providerId') providerId: string,
    @Res() res
  ) {
    const provider = await this.oidcService.getProviderFromDB(providerId);
    const issuer = await Issuer.discover(provider.issuer);

    const client = new issuer.Client({
      client_id: provider.client_id,
      client_secret: provider.client_secret,
      redirect_uris: [ provider.redirect_uri],
      response_types: ['code'],
    }); // => Client

    const redirectTo = client.authorizationUrl({
      scope: provider.scope,
      // resource: 'https://my.api.example.com/resource/32178',
      code_challenge: provider.code_challenge,
      code_challenge_method: provider.code_challenge_method,
    });    
    
    return res.redirect(redirectTo);
  }

  @Get(':providerId/callback')
  async callback(
    @Param('providerId') providerId: string,
    @Query() query,
    @Req() req,
    @Res() res
  ) {
    const provider = await this.oidcService.getProviderFromDB(providerId);
    const issuer = await Issuer.discover(provider.issuer);

    const client = new issuer.Client({
      client_id: provider.client_id,
      client_secret: provider.client_secret,
      redirect_uris: [ provider.redirect_uri],
      response_types: ['code'],
    }); // => Client

    const params = client.callbackParams(req);

    const tokenSet = await client.callback(provider.redirect_uri, params, { code_verifier: provider.code_verifier });
    console.log('received and validated tokens %j', tokenSet);
    console.log('validated ID Token claims %j', tokenSet.claims());
    
    const userInfo = await client.userinfo(tokenSet);
    console.log('userinfo %j', userInfo);

    // 此处可进行登录态建立和用户信息入库等处理
    // 简单返回用户信息作为示例
    return res.json({ tokenSet, userInfo });
  }

}
