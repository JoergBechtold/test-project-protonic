import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';

@Component({
  selector: 'app-popup',
  standalone: true,
  templateUrl: './popup.html',
  styleUrls: ['./popup.scss'],
})
export class Popup {
  private readonly destroyRef = inject(DestroyRef);
  readonly trigger = input<boolean>(false);

  readonly shouldRender = signal(false);
  readonly animationState = signal<'enter' | 'exit'>('exit');

  private readonly DISPLAY_DURATION = 5000;
  private readonly ANIMATION_DURATION = 500;
  private displayTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private hideTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      if (this.trigger()) {
        this.show();
      } else {
        this.hide();
      }
    });

    this.destroyRef.onDestroy(() => {
      this.clearTimers();
    });
  }

  private show(): void {
    this.clearTimers();
    this.shouldRender.set(true);
    this.animationState.set('enter');

    this.displayTimeoutId = setTimeout(() => {
      this.hide();
    }, this.DISPLAY_DURATION);
  }

  private hide(): void {
    if (!this.shouldRender()) {
      return;
    }

    this.clearDisplayTimer();
    this.animationState.set('exit');
    this.hideTimeoutId = setTimeout(() => {
      this.shouldRender.set(false);
      this.hideTimeoutId = null;
    }, this.ANIMATION_DURATION);
  }

  private clearDisplayTimer(): void {
    if (this.displayTimeoutId !== null) {
      clearTimeout(this.displayTimeoutId);
      this.displayTimeoutId = null;
    }
  }

  private clearHideTimer(): void {
    if (this.hideTimeoutId !== null) {
      clearTimeout(this.hideTimeoutId);
      this.hideTimeoutId = null;
    }
  }

  private clearTimers(): void {
    this.clearDisplayTimer();
    this.clearHideTimer();
  }
}
