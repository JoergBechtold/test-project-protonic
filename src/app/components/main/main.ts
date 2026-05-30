import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../shared/services/api.service';
import { firstValueFrom } from 'rxjs';
import { Loading } from '../../shared/components/loading/loading';

@Component({
  selector: 'app-main',
  imports: [CommonModule, Loading],
  templateUrl: './main.html',
  styleUrls: ['./main.scss'],
})
export class MainComponent implements OnInit {
  // Die Spalten-Definitionen aus der API (z.B. "type", "subj", "start"...)
  columns = signal<string[]>([]);

  // Die eigentlichen Datenzeilen, als lesbare Objekte
  rows = signal<any[]>([]);

  isLoading = signal(true);
  errorMessage = signal('ES ist ein Fehler aufgetreten.');

  constructor(private apiService: ApiService) {}

  async ngOnInit(): Promise<void> {
    this.isLoading.set(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const data = await firstValueFrom(this.apiService.getActivitiesList(today));

      if (Array.isArray(data) && data.length > 0) {
        this.columns.set(Object.keys(data[0]));
        this.rows.set(data);
        this.errorMessage.set('');
      } else if (Array.isArray(data) && data.length === 0) {
        this.columns.set([]);
        this.rows.set([]);
        this.errorMessage.set('Keine Aktivitäten gefunden.');
      } else {
        this.columns.set([]);
        this.rows.set([]);
        this.errorMessage.set('ES ist ein Fehler aufgetreten.');
      }
    } catch (err) {
      console.error('API-Fehler:', err);
      this.columns.set([]);
      this.rows.set([]);
      this.errorMessage.set('ES ist ein Fehler aufgetreten.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
