import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../shared/services/api.service';
import { Loading } from '../../shared/components/loading/loading';
import { Popup } from '../../shared/components/popup/popup';

@Component({
  selector: 'app-edit-page',
  imports: [ReactiveFormsModule, Loading, Popup],
  templateUrl: './edit-page.html',
  styleUrls: ['./edit-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditPage {
  private readonly apiService = inject(ApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly defaultActivityId = 90724;

  readonly activityId = input<number | string | null>(null);

  readonly isLoadingFormdata = signal(false);
  readonly isSaving = signal(false);
  readonly loadError = signal('');
  readonly saveMessage = signal('');
  readonly saveError = signal('');
  readonly showSavePopup = signal(false);
  readonly currentActivityId = signal<number | null>(null);
  private readonly loadedFormdata = signal<Record<string, unknown> | null>(null);

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

  async save(): Promise<void> {
    if (this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.saveMessage.set('');
    this.saveError.set('');
    this.showSavePopup.set(false);

    try {
      const activityId = this.resolveActivityId();
      const payload = this.buildSavePayload(activityId);
      await firstValueFrom(this.apiService.saveActivity(payload));
      this.saveMessage.set('Aenderungen wurden gespeichert.');
      queueMicrotask(() => this.showSavePopup.set(true));
    } catch (error) {
      console.error('Fehler beim Speichern der Aktivitaet:', error);
      this.saveError.set('Speichern fehlgeschlagen. Bitte erneut versuchen.');
      this.showSavePopup.set(false);
    } finally {
      this.isSaving.set(false);
    }
  }

  private async loadFormdata(activityId: number): Promise<void> {
    this.isLoadingFormdata.set(true);
    this.loadError.set('');
    this.saveMessage.set('');
    this.saveError.set('');
    this.showSavePopup.set(false);

    try {
      const formdata = await firstValueFrom(this.apiService.getActivityFormdata(activityId));
      const safeFormdata = this.asRecord(formdata);

      this.loadedFormdata.set(safeFormdata);
      this.currentActivityId.set(activityId);

      this.form.patchValue({
        activityType: this.asText(
          this.pickValue(safeFormdata, ['activityType', 'activityTyp', 'type']),
          'E-Mail',
        ),
        caption: this.asText(
          this.pickValue(safeFormdata, ['cap subj', 'subject', 'caption', 'description']),
        ),
        startDate: this.asText(this.pickValue(safeFormdata, ['startDate', 'begda'])),
        startTime: this.asText(this.pickValue(safeFormdata, ['startTime', 'begti'])),
        endDate: this.asText(this.pickValue(safeFormdata, ['endDate', 'endda'])),
        endTime: this.asText(this.pickValue(safeFormdata, ['endTime', 'endti'])),
        assignee: this.asText(this.pickValue(safeFormdata, ['assignee', 'processor', 'ownr'])),
        address: this.asText(
          this.pickValue(safeFormdata, ['address', 'adr', 'location', 'addressText']),
        ),
        finalized: this.asBool(this.pickValue(safeFormdata, ['finalized', 'done', 'isDone'])),
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

    return {
      ...basePayload,
      id: activityId,
      activityId,
      activityType: values.activityType,
      subject: values.caption,
      caption: values.caption,
      startDate: values.startDate,
      startTime: values.startTime,
      endDate: values.endDate,
      endTime: values.endTime,
      assignee: values.assignee,
      ownr: values.assignee,
      address: values.address,
      adr: values.address,
      finalized: values.finalized,
    };
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

  private pickValue(source: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      if (key in source) {
        return source[key];
      }
    }

    return '';
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
}
