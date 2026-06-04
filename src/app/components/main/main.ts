import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../shared/services/api.service';
import { firstValueFrom } from 'rxjs';
import { Loading } from '../../shared/components/loading/loading';
import { PopupComponent } from '../../shared/components/popup/popup';
import { TicketCell, TicketCellViewModel } from './components/ticket-cell/ticket-cell';
import { EditPage } from '../edit-page/edit-page';

type ActivityRow = Record<string, unknown>;
type PaginationItem = { kind: 'page'; page: number; key: string } | { kind: 'dots'; key: string };
type SubjectSortDirection = 'none' | 'asc' | 'desc';

@Component({
  selector: 'app-main',
  imports: [Loading, PopupComponent, TicketCell, EditPage],
  templateUrl: './main.html',
  styleUrls: ['./main.scss'],
})
export class MainComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly router = inject(Router);
  private readonly pageSize = 6;

  isLoading = signal(true);
  errorMessage = signal('ES ist ein Fehler aufgetreten.');
  showSavePopup = signal(false);
  isEditPopupOpen = signal(false);
  selectedTicketId = signal('');

  rows = signal<ActivityRow[]>([]);
  ticketRows = computed<TicketCellViewModel[]>(() =>
    this.rows().map((row, index) => this.toTicketRow(row, index)),
  );
  private static readonly SORT_STORAGE_KEY = 'main-sort';

  private loadSortFromStorage(): { subject: SubjectSortDirection; contact: SubjectSortDirection } {
    try {
      const raw = localStorage.getItem(MainComponent.SORT_STORAGE_KEY);
      if (!raw) return { subject: 'none', contact: 'none' };
      const parsed = JSON.parse(raw);
      const valid: SubjectSortDirection[] = ['none', 'asc', 'desc'];
      return {
        subject: valid.includes(parsed.subject) ? parsed.subject : 'none',
        contact: valid.includes(parsed.contact) ? parsed.contact : 'none',
      };
    } catch {
      return { subject: 'none', contact: 'none' };
    }
  }

  private saveSortToStorage(subject: SubjectSortDirection, contact: SubjectSortDirection): void {
    localStorage.setItem(MainComponent.SORT_STORAGE_KEY, JSON.stringify({ subject, contact }));
  }

  subjectSortDirection = signal<SubjectSortDirection>(this.loadSortFromStorage().subject);
  contactSortDirection = signal<SubjectSortDirection>(this.loadSortFromStorage().contact);
  sortedTicketRows = computed<TicketCellViewModel[]>(() => {
    const subjectDirection = this.subjectSortDirection();
    const contactDirection = this.contactSortDirection();
    const tickets = [...this.ticketRows()];

    if (subjectDirection !== 'none') {
      tickets.sort((left, right) => {
        const comparison = left.title.localeCompare(right.title, 'de', { sensitivity: 'base' });
        return subjectDirection === 'asc' ? comparison : comparison * -1;
      });
    } else if (contactDirection !== 'none') {
      tickets.sort((left, right) => {
        const comparison = left.contactName.localeCompare(right.contactName, 'de', {
          sensitivity: 'base',
        });
        return contactDirection === 'asc' ? comparison : comparison * -1;
      });
    }

    return tickets;
  });
  currentPage = signal(1);
  totalItems = computed(() => this.sortedTicketRows().length);
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
    return this.sortedTicketRows().slice(start, end);
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

  private readonly typeToIconAndBg: Record<number, { icon: string; bg: string; alt: string }> = {
    8: { icon: 'clipboard-icon.png', bg: 'var(--icon-bg-orange)', alt: 'Aufgabe' },
    7: { icon: 'megaphon-icon.png', bg: 'var(--icon-bg-blue)', alt: 'Hinweis' },
    3: { icon: 'edit-icon.png', bg: 'var(--icon-bg-purple)', alt: 'Bearbeitung' },
    2: { icon: 'calendar-icon.png', bg: 'var(--icon-bg-green)', alt: 'Termin' },
    0: { icon: 'mail-icon.png', bg: 'var(--icon-bg-pink)', alt: 'Nachricht' },
  };

  constructor() {
    effect(() => {
      const totalPages = this.totalPages();
      const currentPage = this.currentPage();

      if (totalPages === 0 && currentPage !== 1) {
        this.currentPage.set(1);
        return;
      }

      if (totalPages > 0 && currentPage > totalPages) {
        this.currentPage.set(totalPages);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadActivities();
  }

  async loadActivities(silent = false): Promise<void> {
    if (!silent) {
      this.isLoading.set(true);
    }
    try {
      const data = await firstValueFrom(this.apiService.getActivitiesList());

      const rows = this.extractRows(data);
      if (rows.length > 0) {
        this.rows.set(rows);
        this.errorMessage.set('');
      } else {
        this.rows.set([]);
        this.errorMessage.set('Keine Aktivitäten gefunden.');
      }
    } catch (err) {
      console.error('API-Fehler:', err);
      this.rows.set([]);
      this.errorMessage.set('Es ist ein Fehler aufgetreten.');
    } finally {
      if (!silent) {
        this.isLoading.set(false);
      }
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

  toggleSubjectSort(): void {
    const currentDirection = this.subjectSortDirection();
    const nextDirection: SubjectSortDirection =
      currentDirection === 'none' ? 'asc' : currentDirection === 'asc' ? 'desc' : 'none';

    this.subjectSortDirection.set(nextDirection);
    this.contactSortDirection.set('none');
    this.saveSortToStorage(nextDirection, 'none');
    this.currentPage.set(1);
  }

  toggleContactSort(): void {
    const currentDirection = this.contactSortDirection();
    const nextDirection: SubjectSortDirection =
      currentDirection === 'none' ? 'asc' : currentDirection === 'asc' ? 'desc' : 'none';

    this.contactSortDirection.set(nextDirection);
    this.subjectSortDirection.set('none');
    this.saveSortToStorage('none', nextDirection);
    this.currentPage.set(1);
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

  openEditPage(ticketId: string): void {
    this.selectedTicketId.set(ticketId);
    this.isEditPopupOpen.set(true);
  }

  closeEditPage(): void {
    this.isEditPopupOpen.set(false);
  }

  async onEditPageSaved(): Promise<void> {
    this.closeEditPage();
    this.showSavePopup.set(false);
    queueMicrotask(() => this.showSavePopup.set(true));
    // Liste im Hintergrund neu laden (ohne Loading-Screen)
    await this.loadActivities(true);
  }

  async logout(): Promise<void> {
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);

    localStorage.removeItem('token');

    const didNavigate = await this.router.navigate(['/login']);
    if (!didNavigate) {
      this.isLoading.set(false);
    }
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
    const typeKey = this.toNumber(this.pickFirstValue(row, ['type', 'Type', 'activityType']));
    const typeMeta = this.typeToIconAndBg[typeKey] ?? {
      icon: 'calendar-icon.png',
      bg: 'var(--icon-bg-green)',
      alt: 'Aktivität',
    };

    const id = this.asText(
      this.pickFirstValue(row, ['IdActivity', 'idActivity', 'activityId', 'ActivityId', 'id']),
      String(index + 1),
    );
    const directionLabel = this.asText(this.pickFirstValue(row, ['dir', 'direction', 'Direction']));
    const startsAt = this.asText(
      this.pickFirstValue(row, ['start', 'Start', 'startDate', 'StartDate', 'date', 'begda']),
    );
    const startTime = this.asText(
      this.pickFirstValue(row, ['startTime', 'StartTime', 'timeStart', 'begti']),
      '',
    );
    const endTime = this.asText(
      this.pickFirstValue(row, ['endTime', 'EndTime', 'timeEnd', 'endti']),
      '',
    );
    const schedule = this.parseSchedule(startsAt, startTime, endTime);
    const contactName = this.asText(
      this.pickFirstValue(row, ['adr', 'address', 'location', 'contact']),
    );
    const ownerName = this.asText(
      this.pickFirstValue(row, ['ownr', 'owner', 'assignee', 'processor']),
    );
    const title = this.asText(
      this.pickFirstValue(row, ['cap subj', 'caption', 'subject', 'title', 'name']),
      'Ohne Betreff',
    );
    const priorityLabel = this.asText(this.pickFirstValue(row, ['prio', 'priority', 'Priority']));

    return {
      id,
      typeIconSrc: `assets/icons/${typeMeta.icon}`,
      typeIconAlt: typeMeta.alt,
      typeBgColor: typeMeta.bg,
      title,
      location: contactName === '-' ? 'Kein Ort' : contactName,
      contactInitials: this.getInitials(contactName),
      contactName,
      ownerInitials: this.getInitials(ownerName),
      ownerName,
      dueDay: schedule.day,
      dueTime: schedule.time,
      priorityLabel,
      directionLabel,
      directionArrowLeft: this.isDirectionIncoming(directionLabel),
    };
  }

  private pickFirstValue(source: ActivityRow, keys: string[]): unknown {
    for (const key of keys) {
      if (key in source) {
        return source[key];
      }
    }

    return undefined;
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

  private parseSchedule(
    value: string,
    startTimeValue: string,
    endTimeValue: string,
  ): { day: string; time: string } {
    if (value === '-' && startTimeValue.length === 0 && endTimeValue.length === 0) {
      return { day: '-', time: '-' };
    }

    const normalized = value.replace(/\s+/g, ' ').trim();
    const startTime = this.extractTimeValue(startTimeValue) ?? this.extractTimeValue(normalized);
    const endTime = this.extractTimeValue(endTimeValue);

    if (startTime && endTime) {
      return { day: this.deriveDayLabel(normalized), time: `${startTime} – ${endTime}` };
    }

    if (startTime) {
      return { day: this.deriveDayLabel(normalized), time: startTime };
    }

    const timeRange = normalized.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/)?.[0];
    if (timeRange) {
      const day = normalized.replace(timeRange, '').trim() || this.deriveDayLabel(normalized);
      return { day, time: timeRange.replace(/\s*-\s*/, ' – ') };
    }

    const fallbackTime = /[a-zA-Z]/.test(normalized) ? normalized : '-';
    return { day: this.deriveDayLabel(normalized), time: fallbackTime };
  }

  private extractTimeValue(value: string): string | null {
    const match = value.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\b/);
    if (!match) {
      return null;
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }

    const safeHour = Math.min(Math.max(hour, 0), 23);
    const safeMinute = Math.min(Math.max(minute, 0), 59);
    return `${String(safeHour).padStart(2, '0')}:${String(safeMinute).padStart(2, '0')}`;
  }

  private deriveDayLabel(value: string): string {
    if (!value || value === '-') {
      return '-';
    }

    const date = this.extractDateValue(value);
    if (!date) {
      const normalizedText = value.replace(/\s+/g, ' ').trim();
      if (normalizedText.length === 0) {
        return '-';
      }

      const knownRelativeLabel = normalizedText.toLowerCase();
      if (
        knownRelativeLabel === 'heute' ||
        knownRelativeLabel === 'morgen' ||
        knownRelativeLabel === 'gestern'
      ) {
        return normalizedText[0].toUpperCase() + normalizedText.slice(1).toLowerCase();
      }

      return 'Heute';
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayDiff = Math.round((target.getTime() - today.getTime()) / 86400000);

    if (dayDiff === 0) {
      return 'Heute';
    }

    if (dayDiff === 1) {
      return 'Morgen';
    }

    if (dayDiff === -1) {
      return 'Gestern';
    }

    const weekdayLabels = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const weekday = weekdayLabels[target.getDay()];
    const day = String(target.getDate()).padStart(2, '0');
    const month = String(target.getMonth() + 1).padStart(2, '0');

    return `${weekday} ${day}.${month}.`;
  }

  private extractDateValue(value: string): Date | null {
    const normalized = value.replace(/\s+/g, ' ').trim();

    const yearFirst = normalized.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (yearFirst) {
      const parsed = this.buildDate(yearFirst[1], yearFirst[2], yearFirst[3]);
      if (parsed) {
        return parsed;
      }
    }

    const dayFirst = normalized.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{4})/);
    if (dayFirst) {
      const parsed = this.buildDate(dayFirst[3], dayFirst[2], dayFirst[1]);
      if (parsed) {
        return parsed;
      }
    }

    const compact = normalized.match(/\b(\d{4})(\d{2})(\d{2})\b/);
    if (compact) {
      return this.buildDate(compact[1], compact[2], compact[3]);
    }

    return null;
  }

  private buildDate(yearText: string, monthText: string, dayText: string): Date | null {
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }

    const date = new Date(year, month - 1, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  private isDirectionIncoming(value: string): boolean {
    return value.toLowerCase().includes('ein');
  }
}
