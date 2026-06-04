import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private baseUrl = environment.apiUrl;
  private readonly defaultActivitiesStartDate = '2020-01-01';

  constructor(private http: HttpClient) {}

  // Baut die Auth-Header, die easyjob bei JEDER Anfrage erwartet
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'ej-webapi-client': 'ThirdParty',
    });
  }

  // Holt die Liste aller Aktivitäten (neuer Endpunkt!)
  getActivitiesList(
    startDate = this.defaultActivitiesStartDate,
    idActivity?: number,
  ): Observable<any> {
    // Standard: 2020-01-01 (kann bei Bedarf beim Aufruf ueberschrieben werden)
    const idActivityParam =
      typeof idActivity === 'number' && Number.isFinite(idActivity)
        ? `&IdActivity=${idActivity}`
        : '';
    const url = `${this.baseUrl}/api.json/v2/crm/Activities/List?IsActivityCenter=true&StartDate=${startDate}${idActivityParam}`;
    return this.http.get<any>(url, { headers: this.getAuthHeaders() });
  }

  // Holt die Detaildaten einer Aktivität anhand der ID
  getActivityDetails(id: number): Observable<any> {
    // Beispiel-URL: /api.json/Activities/Details/90724
    const url = `${this.baseUrl}/api.json/Activities/Details/${id}`;
    return this.http.get<any>(url, { headers: this.getAuthHeaders() });
  }

  // Holt die Formulardaten für eine Aktivität (z.B. für das Bearbeiten-Formular)
  getActivityFormdata(id: number): Observable<any> {
    // Beispiel-URL: /api.json/Activities/GetFormdata/90724
    const url = `${this.baseUrl}/api.json/Activities/GetFormdata/${id}`;
    return this.http.get<any>(url, { headers: this.getAuthHeaders() });
  }

  // Speichert (erstellt oder aktualisiert) eine Aktivität über die API
  // Die Daten müssen als Objekt (z.B. aus einem Formular) übergeben werden
  saveActivity(activityData: any): Observable<any> {
    // POST-Request an den Save-Endpunkt
    // Die API erwartet die Daten direkt im Body als JSON (ohne model Wrapper)
    const url = `${this.baseUrl}/api.json/Activities/Save`;
    console.log('=== API SERVICE: Sending to', url, '===');
    console.log('Payload:', activityData);
    return this.http.post<any>(url, activityData, { headers: this.getAuthHeaders() });
  }

  /**
   * Lädt Details und Formulardaten für eine Aktivität PARALLEL (gleichzeitig).
   * Gibt ein Promise zurück, das beide Ergebnisse als Array enthält: [details, formdata]
   * Vorteil: Beide Requests laufen gleichzeitig, das ist schneller als nacheinander!
   *
   * Beispiel-Aufruf:
   *   const [details, formdata] = await apiService.getActivityDetailsAndFormdata(123);
   */
  async getActivityDetailsAndFormdata(id: number): Promise<[any, any]> {
    // Wir wandeln die Observables in Promises um und starten beide Requests gleichzeitig (modern: firstValueFrom)
    return Promise.all([
      firstValueFrom(this.getActivityDetails(id)),
      firstValueFrom(this.getActivityFormdata(id)),
    ]);
  }
}
