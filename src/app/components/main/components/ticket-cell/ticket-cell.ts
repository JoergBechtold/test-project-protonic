import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface TicketCellViewModel {
  id: string;
  typeIconSrc: string;
  typeIconAlt: string;
  typeBgColor: string;
  title: string;
  location: string;
  contactInitials: string;
  contactName: string;
  ownerInitials: string;
  ownerName: string;
  dueDay: string;
  dueTime: string;
  priorityLabel: string;
  directionLabel: string;
  directionArrowLeft: boolean;
}

@Component({
  selector: 'app-ticket-cell',
  templateUrl: './ticket-cell.html',
  styleUrl: './ticket-cell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketCell {
  ticket = input.required<TicketCellViewModel>();
  ticketSelected = output<string>();

  onSelect(): void {
    this.ticketSelected.emit(this.ticket().id);
  }
}
