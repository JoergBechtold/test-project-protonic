import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
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
  readonly allowBodyEdit = signal(true);

  readonly form = this.formBuilder.nonNullable.group({
    activityTypeId: '',
    caption: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    assigneeId: '',
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

    // Textarea für Beschreibung deaktivieren, wenn AllowBodyEdit false ist
    if (!this.allowBodyEdit()) {
      this.form.controls.address.disable();
    }
  }

  onAddressTextChange(): void {
    this.updateAddressDataFromText(this.form.controls.address.value ?? '');
  }

  async save(): Promise<void> {
    if (this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.saveMessage.set('');
    this.saveError.set('');

    try {
      // Aktualisiere Adressdaten aus dem Textarea vor dem Speichern
      const addressText = this.form.controls.address.value;
      if (addressText && this.addressData()) {
        this.updateAddressDataFromText(addressText);
      }

      const activityId = this.resolveActivityId();
      const payload = this.buildSavePayload(activityId);
      const response = await firstValueFrom(this.apiService.saveActivity(payload));

      if (response && response.Success === false) {
        const fieldErrors = response.ErrorMessages
          ? Object.values(response.ErrorMessages as Record<string, string>).join(' ')
          : '';
        throw new Error(fieldErrors || response.Message || 'Unbekannter Fehler vom Server.');
      }

      // Erfolgreich gespeichert!
      console.log('=== SAVE SUCCESSFUL ===');
      this.closeRequested.emit();
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
      this.allowBodyEdit.set(this.asBool(combinedData['AllowBodyEdit']) !== false);

      const startDateParsed = this.parseDateTime(combinedData['StartDate']);
      const endDateParsed = this.parseDateTime(combinedData['EndDate']);

      // Body-Feld für Notizen/Beschreibung
      const bodyText = this.asText(combinedData['Body'], '');
      const normalizedAddress = this.buildAddressFromText(bodyText, combinedData['Address']);

      const activityTypeId = combinedData['IdActivityType'];
      const assigneeId = combinedData['IdUser'];

      this.addressData.set(normalizedAddress);

      console.log('=== LOADING FORM DATA ===');
      console.log('IdActivityType:', activityTypeId);
      console.log('Caption:', combinedData['Caption']);
      console.log('IdUser:', assigneeId);
      console.log('Body:', bodyText);

      this.form.patchValue({
        activityTypeId: activityTypeId ? String(activityTypeId) : '',
        caption: this.asText(combinedData['Caption']),
        startDate: startDateParsed.date,
        startTime: startDateParsed.time,
        endDate: endDateParsed.date,
        endTime: endDateParsed.time,
        assigneeId: assigneeId ? String(assigneeId) : '',
        address: this.formatAddress(normalizedAddress) || bodyText,
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
    const normalizedAddress = this.buildAddressFromText(
      values.address || '',
      this.addressData() ?? (basePayload as any)['Address'],
    );

    this.addressData.set(normalizedAddress);

    console.log('=== BUILDING SAVE PAYLOAD ===');
    console.log('Form values:', values);
    console.log('Base payload:', basePayload);

    // IDs direkt aus dem Formular nehmen und in Zahlen konvertieren
    const idActivityType = values.activityTypeId ? Number(values.activityTypeId) : 1;
    const idUser = values.assigneeId ? Number(values.assigneeId) : undefined;
    const caption = values.caption || (basePayload as any)['Caption'] || '';

    console.log('Parsed IdActivityType:', idActivityType);
    console.log('Parsed Caption:', caption);
    console.log('Parsed IdUser:', idUser);

    const payload = {
      ...basePayload,
      IdActivity: activityId,
      IdActivityType: idActivityType,
      Caption: caption,
      StartDate: this.formatDateTimeForApi(values.startDate, values.startTime),
      EndDate: this.formatDateTimeForApi(values.endDate, values.endTime),
      IdUser: idUser !== undefined ? idUser : (basePayload as any)['IdUser'],
      Body: values.address || '',
      Address: normalizedAddress,
      Finalized: values.finalized,
    };

    console.log('Final payload:', payload);
    return payload;
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

  private updateAddressDataFromText(text: string): void {
    this.addressData.set(this.buildAddressFromText(text, this.addressData()));
  }

  private buildAddressFromText(
    text: string,
    fallbackAddress: unknown,
  ): Record<string, unknown> | null {
    const currentAddress = this.asRecord(fallbackAddress);

    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return Object.keys(currentAddress).length > 0 ? { ...currentAddress } : null;
    }

    const updatedAddress: Record<string, unknown> = { ...currentAddress };

    if (lines[0]) {
      const nameParts = lines[0].split(/\s+/).filter(Boolean);
      if (nameParts.length > 1) {
        updatedAddress['FirstName'] = nameParts[0];
        updatedAddress['Surname'] = nameParts.slice(1).join(' ');
      } else {
        updatedAddress['FirstName'] = '';
        updatedAddress['Surname'] = lines[0];
      }
    } else {
      updatedAddress['FirstName'] = '';
      updatedAddress['Surname'] = '';
    }

    updatedAddress['Street'] = lines[1] ?? '';

    if (lines[2]) {
      const zipCityMatch = lines[2].match(/^(\d+)\s+(.+)$/);
      if (zipCityMatch) {
        updatedAddress['Zip'] = zipCityMatch[1];
        updatedAddress['City'] = zipCityMatch[2];
      } else {
        updatedAddress['Zip'] = '';
        updatedAddress['City'] = lines[2];
      }
    } else {
      updatedAddress['Zip'] = '';
      updatedAddress['City'] = '';
    }

    if (updatedAddress['Country'] && typeof updatedAddress['Country'] === 'object') {
      updatedAddress['Country'] = {
        ...(updatedAddress['Country'] as Record<string, unknown>),
        Caption: lines[3] ?? '',
      };
    }

    return updatedAddress;
  }
}
