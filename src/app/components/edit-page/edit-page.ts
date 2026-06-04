import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../shared/services/api.service';
import { Loading } from '../../shared/components/loading/loading';

@Component({
  selector: 'app-edit-page',
  imports: [ReactiveFormsModule, Loading],
  templateUrl: './edit-page.html',
  styleUrls: ['./edit-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditPage {
  private readonly apiService = inject(ApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly defaultActivityId = 1;

  readonly activityId = input<number | string | null>(null);

  readonly isLoadingFormdata = signal(false);
  readonly isSaving = signal(false);
  readonly loadError = signal('');
  readonly saveMessage = signal('');
  readonly saveError = signal('');
  readonly closeRequested = output<void>();
  readonly closed = output<void>();
  readonly currentActivityId = signal<number | null>(null);
  private readonly loadedFormdata = signal<Record<string, unknown> | null>(null);
  readonly activityTypes = signal<any[]>([]);
  readonly users = signal<any[]>([]);
  readonly addressData = signal<any>(null);
  readonly isEditable = signal(false);

  readonly form = this.formBuilder.nonNullable.group({
    activityType: 'E-Mail',
    caption: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    assignee: '',
    address: '',
    finalized: false,
  });

  constructor() {
    effect(() => {
      const resolvedActivityId = this.resolveActivityId();
      if (this.currentActivityId() === resolvedActivityId) {
        return;
      }

      void this.loadFormdata(resolvedActivityId);
    });
  }

  onSaveSubmit(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    void this.save();
  }

  onClose(): void {
    this.closed.emit();
  }

  onEdit(): void {
    this.isEditable.set(true);
    this.form.enable();
  }

  async save(): Promise<void> {
    if (this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.saveMessage.set('');
    this.saveError.set('');

    try {
      const activityId = this.resolveActivityId();
      const payload = this.buildSavePayload(activityId);
      const response = await firstValueFrom(this.apiService.saveActivity(payload));

      if (response && response.Success === false) {
        const fieldErrors = response.ErrorMessages
          ? Object.values(response.ErrorMessages as Record<string, string>).join(' ')
          : '';
        throw new Error(fieldErrors || response.Message || 'Unbekannter Fehler vom Server.');
      }

      this.saveMessage.set('Änderungen wurden gespeichert.');
      this.isEditable.set(false);
      this.form.disable();
    } catch (error) {
      console.error('Fehler beim Speichern der Aktivitaet:', error);
      this.saveError.set(this.buildSaveErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  private async loadFormdata(activityId: number): Promise<void> {
    this.isLoadingFormdata.set(true);
    this.loadError.set('');
    this.saveMessage.set('');
    this.saveError.set('');
    this.form.disable();
    this.isEditable.set(false);

    try {
      const [details, formdata] = await this.apiService.getActivityDetailsAndFormdata(activityId);
      const safeDetails = this.asRecord(details);
      const safeFormdata = this.asRecord(formdata);

      this.loadedFormdata.set(safeDetails);
      this.currentActivityId.set(activityId);

      const combinedData = { ...safeDetails, ...safeFormdata };

      this.activityTypes.set(
        Array.isArray(combinedData['ActivityTypes']) ? combinedData['ActivityTypes'] : [],
      );
      this.users.set(Array.isArray(combinedData['Users']) ? combinedData['Users'] : []);
      this.addressData.set(combinedData['Address'] || null);

      const startDateParsed = this.parseDateTime(combinedData['StartDate']);
      const endDateParsed = this.parseDateTime(combinedData['EndDate']);
      const addressText = this.formatAddress(combinedData['Address']);

      this.form.patchValue({
        activityType: this.asText(combinedData['ActivityType'], 'E-Mail'),
        caption: this.asText(combinedData['Caption']),
        startDate: startDateParsed.date,
        startTime: startDateParsed.time,
        endDate: endDateParsed.date,
        endTime: endDateParsed.time,
        assignee: this.asText(combinedData['User']),
        address: addressText,
        finalized: this.asBool(combinedData['Finalized']),
      });
    } catch (error) {
      console.error('Fehler beim Laden der Formulardaten:', error);
      this.loadError.set('Formulardaten konnten nicht geladen werden.');
      this.loadedFormdata.set(null);
      this.currentActivityId.set(activityId);
    } finally {
      this.isLoadingFormdata.set(false);
    }
  }

  private buildSavePayload(activityId: number): Record<string, unknown> {
    const basePayload = this.loadedFormdata() ?? {};
    const values = this.form.getRawValue();

    const selectedType = this.activityTypes().find(t => t.Caption === values.activityType);
    const selectedUser = this.users().find(u => u.Caption === values.assignee);

    return {
      ...basePayload,
      id: activityId,
      activityId,
      IdActivityType: selectedType?.IdActivityType ?? (basePayload as any)['IdActivityType'],
      ActivityType: values.activityType,
      activityType: values.activityType,
      Caption: values.caption,
      caption: values.caption,
      subject: values.caption,
      StartDate: this.formatDateTimeForApi(values.startDate, values.startTime),
      startDate: this.formatDateTimeForApi(values.startDate, values.startTime),
      EndDate: this.formatDateTimeForApi(values.endDate, values.endTime),
      endDate: this.formatDateTimeForApi(values.endDate, values.endTime),
      IdUser: selectedUser?.IdUser ?? (basePayload as any)['IdUser'],
      User: values.assignee,
      assignee: values.assignee,
      ownr: values.assignee,
      adr: values.address,
      Finalized: values.finalized,
      finalized: values.finalized,
    };
  }

  private formatDateTimeForApi(date: string, time: string): string {
    if (!date) return '';
    const parts = date.split('.');
    if (parts.length !== 3) return date;
    const [day, month, year] = parts;
    const [hours, minutes] = (time || '00:00').split(':');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${(hours || '00').padStart(2, '0')}:${(minutes || '00').padStart(2, '0')}:00.0000000`;
  }

  private resolveActivityId(): number {
    const rawInput = this.activityId();
    const parsed = Number(rawInput);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : this.defaultActivityId;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private parseDateTime(value: unknown): { date: string; time: string } {
    if (!value || typeof value !== 'string') {
      return { date: '', time: '' };
    }
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return { date: '', time: '' };
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return { date: `${day}.${month}.${year}`, time: `${hours}:${minutes}` };
    } catch {
      return { date: '', time: '' };
    }
  }

  private formatAddress(address: unknown): string {
    if (!address || typeof address !== 'object') {
      return '';
    }
    const addr = address as Record<string, unknown>;
    const parts: string[] = [];
    if (addr['Company']) parts.push(String(addr['Company']));
    if (addr['FirstName'] || addr['Surname']) {
      const name = [addr['FirstName'], addr['Surname']].filter(Boolean).join(' ');
      if (name) parts.push(name);
    }
    if (addr['Street']) parts.push(String(addr['Street']));
    if (addr['Zip'] || addr['City']) {
      const location = [addr['Zip'], addr['City']].filter(Boolean).join(' ');
      if (location) parts.push(location);
    }
    if (addr['Country'] && typeof addr['Country'] === 'object') {
      const country = addr['Country'] as Record<string, unknown>;
      if (country['Caption']) parts.push(String(country['Caption']));
    }
    return parts.join('\n');
  }

  private asText(value: unknown, fallback = ''): string {
    if (value === null || value === undefined) {
      return fallback;
    }

    const text = String(value).trim();
    return text.length > 0 ? text : fallback;
  }

  private asBool(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value === 1;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return (
        normalized === '1' || normalized === 'true' || normalized === 'ja' || normalized === 'yes'
      );
    }

    return false;
  }

  private buildSaveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const serverMessage = this.extractServerMessage(error.error);
      if (serverMessage) {
        return `Speichern fehlgeschlagen: ${serverMessage}`;
      }

      return `Speichern fehlgeschlagen (HTTP ${error.status || 'unbekannt'}).`;
    }

    if (error instanceof Error && error.message.trim().length > 0) {
      return `Speichern fehlgeschlagen: ${error.message}`;
    }

    return 'Speichern fehlgeschlagen. Bitte erneut versuchen.';
  }

  private extractServerMessage(errorBody: unknown): string {
    if (!errorBody) {
      return '';
    }

    if (typeof errorBody === 'string') {
      return errorBody.trim();
    }

    if (typeof errorBody === 'object') {
      const record = errorBody as Record<string, unknown>;
      const candidates = ['message', 'Message', 'error', 'Error', 'detail', 'Detail'];
      for (const key of candidates) {
        const value = record[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          return value.trim();
        }
      }
    }

    return '';
  }
}
