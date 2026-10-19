import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { TasksController } from './tasks.controller';
import { NotificationsService } from './notifications.service';
import { MailerService } from './mailer.service';
import { RemindersService } from './reminders.service';
import { AvisoSalidaService } from './aviso-salida.service';

@Module({
  controllers: [NotificationsController, TasksController],
  providers: [NotificationsService, MailerService, RemindersService, AvisoSalidaService],
  exports: [NotificationsService, MailerService, RemindersService],
})
export class NotificationsModule {}
