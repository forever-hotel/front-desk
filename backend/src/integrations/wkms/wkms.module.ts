import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WkmsClient } from './wkms.client';
import { WkmsHttpClient } from './wkms-http.client';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: WkmsClient,
      useClass: WkmsHttpClient,
    },
  ],
  exports: [WkmsClient],
})
export class WkmsModule {}
