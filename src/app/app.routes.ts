import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login/login').then((module) => module.LoginComponent),
  },
  {
    path: 'main',
    loadComponent: () => import('./components/main/main').then((module) => module.MainComponent),
    // canActivate: [authGuard],
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
