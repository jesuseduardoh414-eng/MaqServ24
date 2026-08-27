import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { TasksController } from './tasks.controller';
import { NotificationsService } from './notifications.service';
import { MailerService } from './mailer.service';
import { RemindersService } from './reminders.service';

@Module({
  controllers: [NotificationsController, TasksController],
  providers: [NotificationsService, MailerService, RemindersService],
  exports: [NotificationsService, MailerService, RemindersService],
})
export class NotificationsModule {}
