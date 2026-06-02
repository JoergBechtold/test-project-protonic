import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ApiService } from '../../shared/services/api.service';
import { firstValueFrom } from 'rxjs';
import { Loading } from '../../shared/components/loading/loading';
import { TicketCell, TicketCellViewModel } from './components/ticket-cell/ticket-cell';

type ActivityRow = Record<string, unknown>;
type PaginationItem = { kind: 'page'; page: number; key: string } | { kind: 'dots'; key: string };

@Component({
  selector: 'app-main',
  imports: [Loading, TicketCell],
  templateUrl: './main.html',
  styleUrls: ['./main.scss'],
})
export class MainComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly pageSize = 6;

  rows = signal<ActivityRow[]>([]);
  ticketRows = computed<TicketCellViewModel[]>(() =>
    this.rows().map((row, index) => this.toTicketRow(row, index)),
  );
  currentPage = signal(1);
  totalItems = computed(() => this.ticketRows().length);
  totalPages = computed(() => Math.ceil(this.totalItems() / this.pageSize));
  activePage = computed(() => {
    const totalPages = this.totalPages();
    if (totalPages === 0) {
      return 1;
    }

    const currentPage = this.currentPage();
    if (currentPage < 1) {
      return 1;
    }

    if (currentPage > totalPages) {
      return totalPages;
    }

    return currentPage;
  });
  pagedTicketRows = computed<TicketCellViewModel[]>(() => {
    const start = (this.activePage() - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.ticketRows().slice(start, end);
  });
  pageRangeLabel = computed(() => {
    const totalItems = this.totalItems();
    if (totalItems === 0) {
      return '0-0 von 0';
    }

    const start = (this.activePage() - 1) * this.pageSize + 1;
    const end = Math.min(start + this.pageSize - 1, totalItems);
    return `${start}-${end} von ${totalItems}`;
  });
  paginationItems = computed<PaginationItem[]>(() => {
    const totalPages = this.totalPages();
    if (totalPages === 0) {
      return [];
    }

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => {
        const page = index + 1;
        return { kind: 'page', page, key: `page-${page}` };
      });
    }

    const current = this.activePage();
    const items: PaginationItem[] = [{ kind: 'page', page: 1, key: 'page-1' }];
    const middleStart = Math.max(2, current - 1);
    const middleEnd = Math.min(totalPages - 1, current + 1);

    if (middleStart > 2) {
      items.push({ kind: 'dots', key: 'dots-left' });
    }

    for (let page = middleStart; page <= middleEnd; page += 1) {
      items.push({ kind: 'page', page, key: `page-${page}` });
    }

    if (middleEnd < totalPages - 1) {
      items.push({ kind: 'dots', key: 'dots-right' });
    }

    items.push({ kind: 'page', page: totalPages, key: `page-${totalPages}` });
    return items;
  });
  isLoading = signal(true);
  errorMessage = signal('ES ist ein Fehler aufgetreten.');

  private readonly typeToIconAndBg: Record<number, { icon: string; bg: string; alt: string }> = {
    8: { icon: 'clipboard-icon.png', bg: 'var(--icon-bg-orange)', alt: 'Aufgabe' },
    7: { icon: 'megaphon-icon.png', bg: 'var(--icon-bg-blue)', alt: 'Hinweis' },
    3: { icon: 'edit-icon.png', bg: 'var(--icon-bg-purple)', alt: 'Bearbeitung' },
    2: { icon: 'calendar-icon.png', bg: 'var(--icon-bg-green)', alt: 'Termin' },
    0: { icon: 'mail-icon.png', bg: 'var(--icon-bg-pink)', alt: 'Nachricht' },
  };

  constructor() {
    effect(
      () => {
        const totalPages = this.totalPages();
        const currentPage = this.currentPage();

        if (totalPages === 0 && currentPage !== 1) {
          this.currentPage.set(1);
          return;
        }

        if (totalPages > 0 && currentPage > totalPages) {
          this.currentPage.set(totalPages);
        }
      },
      { allowSignalWrites: true },
    );
  }

  async ngOnInit(): Promise<void> {
    this.isLoading.set(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const data = await firstValueFrom(this.apiService.getActivitiesList(today));

      const rows = this.extractRows(data);
      if (rows.length > 0) {
        this.rows.set(rows);
        this.currentPage.set(1);
        this.errorMessage.set('');
      } else {
        this.rows.set([]);
        this.currentPage.set(1);
        this.errorMessage.set('Keine Aktivitäten gefunden.');
      }
    } catch (err) {
      console.error('API-Fehler:', err);
      this.rows.set([]);
      this.currentPage.set(1);
      this.errorMessage.set('Es ist ein Fehler aufgetreten.');
    } finally {
      this.isLoading.set(false);
    }
  }

  goToPage(page: number): void {
    const totalPages = this.totalPages();
    if (totalPages === 0) {
      return;
    }

    const nextPage = Math.min(Math.max(page, 1), totalPages);
    this.currentPage.set(nextPage);
  }

  goToPreviousPage(): void {
    this.goToPage(this.activePage() - 1);
  }

  goToNextPage(): void {
    this.goToPage(this.activePage() + 1);
  }

  canGoPrevious(): boolean {
    return this.totalPages() > 0 && this.activePage() > 1;
  }

  canGoNext(): boolean {
    return this.totalPages() > 0 && this.activePage() < this.totalPages();
  }

  private extractRows(data: unknown): ActivityRow[] {
    if (Array.isArray(data)) {
      return data.filter(this.isActivityRow);
    }

    if (this.isActivityRow(data)) {
      const collectionCandidates = ['data', 'Data', 'items', 'Items', 'result', 'Result'];
      for (const key of collectionCandidates) {
        const candidate = data[key];
        if (Array.isArray(candidate)) {
          return candidate.filter(this.isActivityRow);
        }
      }
    }

    return [];
  }

  private isActivityRow(value: unknown): value is ActivityRow {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private toTicketRow(row: ActivityRow, index: number): TicketCellViewModel {
    const typeKey = this.toNumber(row['type']);
    const typeMeta = this.typeToIconAndBg[typeKey] ?? {
      icon: 'calendar-icon.png',
      bg: 'var(--icon-bg-green)',
      alt: 'Aktivität',
    };

    const directionLabel = this.asText(row['dir']);
    const startsAt = this.asText(row['start']);
    const schedule = this.parseSchedule(startsAt);
    const contactName = this.asText(row['adr']);
    const ownerName = this.asText(row['ownr']);

    return {
      id: this.asText(row['id'], String(index + 1)),
      typeIconSrc: `assets/icons/${typeMeta.icon}`,
      typeIconAlt: typeMeta.alt,
      typeBgColor: typeMeta.bg,
      title: this.asText(row['cap subj'], 'Ohne Betreff'),
      location: this.asText(row['adr'], 'Kein Ort'),
      contactInitials: this.getInitials(contactName),
      contactName,
      ownerInitials: this.getInitials(ownerName),
      ownerName,
      dueDay: schedule.day,
      dueTime: schedule.time,
      priorityLabel: this.asText(row['prio']),
      directionLabel,
      directionArrowLeft: this.isDirectionIncoming(directionLabel),
    };
  }

  private asText(value: unknown, fallback = '-'): string {
    if (value === null || value === undefined) {
      return fallback;
    }

    const text = String(value).trim();
    return text.length > 0 ? text : fallback;
  }

  private toNumber(value: unknown): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : -1;
  }

  private getInitials(value: string): string {
    const words = value
      .split(' ')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (words.length === 0) {
      return '--';
    }

    return words
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }

  private parseSchedule(value: string): { day: string; time: string } {
    if (value === '-') {
      return { day: '-', time: '-' };
    }

    const normalized = value.replace(/\s+/g, ' ').trim();
    const timeRange = normalized.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/)?.[0];

    if (!timeRange) {
      return { day: 'Heute', time: normalized };
    }

    const day = normalized.replace(timeRange, '').trim() || 'Heute';
    return { day, time: timeRange };
  }

  private isDirectionIncoming(value: string): boolean {
    return value.toLowerCase().includes('ein');
  }
}
