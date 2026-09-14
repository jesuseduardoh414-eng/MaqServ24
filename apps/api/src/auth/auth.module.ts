import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';
import { NotificationsModule } from '../notifications/notifications.module';

// JWT propio firmado por la API (ver common/app-auth.ts). NotificationsModule
// aporta el MailerService para el correo de "olvidé mi contraseña".
@Module({
  imports: [NotificationsModule],
  controllers: [AuthController],
  providers: [AuthService, JwtGuard],
  exports: [JwtGuard],
})
export class AuthModule {}
