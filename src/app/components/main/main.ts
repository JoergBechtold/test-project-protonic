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
  columns = signal<string[]>([]);
  rows = signal<any[]>([]);
  isLoading = signal(true);
  errorMessage = signal('ES ist ein Fehler aufgetreten.');

  visibleColumns = ['type', 'cap subj', 'adr', 'ownr', 'start', 'prio', 'dir'];

  typeToIconAndBg: { [key: number]: { icon: string; bg: string } } = {
    8: { icon: 'clipboard-icon.png', bg: 'var(--icon-bg-orange)' },
    7: { icon: 'megaphon-icon.png', bg: 'var(--icon-bg-blue)' },
    3: { icon: 'edit-icon.png', bg: 'var(--icon-bg-purple)' },
    2: { icon: 'calendar-icon.png', bg: 'var(--icon-bg-green)' },
    0: { icon: 'mail-icon.png', bg: 'var(--icon-bg-pink)' },
  };

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
        this.errorMessage.set('Es ist ein Fehler aufgetreten.');
      }
    } catch (err) {
      console.error('API-Fehler:', err);
      this.columns.set([]);
      this.rows.set([]);
      this.errorMessage.set('Es ist ein Fehler aufgetreten.');
    } finally {
      this.isLoading.set(false);
    }
  }

  getDirIcon(row: any): string {
    const value = (row['dir'] || '').toLowerCase();
    if (value.includes('aus') || value.includes('ein')) {
      return 'assets/icons/arrow-icon.png';
    }
    return 'assets/icons/dash-icon.png';
  }

  isDirLeftBlue(row: any): boolean {
    const value = (row['dir'] || '').toLowerCase();
    return value.includes('ein');
  }

  getIconForType(type: any): string {
    const key = Number(type);
    const entry = this.typeToIconAndBg[key];
    return entry ? `assets/icons/${entry.icon}` : '';
  }

  getBgColorForType(type: any): string {
    const key = Number(type);
    const entry = this.typeToIconAndBg[key];
    return entry ? entry.bg : '#F3F3F3';
  }
}
