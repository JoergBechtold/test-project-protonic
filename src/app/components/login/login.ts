import { Component, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Loading } from '../../shared/components/loading/loading';

@Component({
  selector: 'app-login',
  imports: [FormsModule, Loading],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
})
export class LoginComponent {
  username = '';
  password = '';
  errorMessage = signal('');
  isLoading = signal(false);

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  async login() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    const body = new HttpParams()
      .set('grant_type', 'password')
      .set('username', this.username)
      .set('password', this.password);

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
      'ej-webapi-client': 'ThirdParty',
    });

    try {
      const response = await firstValueFrom(
        this.http.post<{ access_token: string }>(`${environment.apiUrl}/token`, body.toString(), {
          headers,
        }),
      );
      localStorage.setItem('token', response.access_token);
      this.router.navigate(['/main']);
    } catch {
      this.errorMessage.set('Login fehlgeschlagen. Bitte überprüfe Benutzername und Passwort.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
