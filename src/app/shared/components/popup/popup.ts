import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';

export const POPUP_DISPLAY_DURATION_MS = 3000;

@Component({
  selector: 'app-popup',
  standalone: true,
  templateUrl: './popup.html',
  styleUrls: ['./popup.scss'],
})
export class PopupComponent {
  private readonly destroyRef = inject(DestroyRef);
  readonly trigger = input<boolean>(false);
  readonly displayDuration = input<number>(POPUP_DISPLAY_DURATION_MS);

  readonly shouldRender = signal(false);
  readonly animationState = signal<'enter' | 'exit'>('exit');

  private readonly ANIMATION_DURATION = 200;
  private displayTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private hideTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private hasInitialized = false;
  private lastTriggerValue = false;

  constructor() {
    effect(() => {
      const currentTriggerValue = this.trigger();

      if (!this.hasInitialized) {
        this.hasInitialized = true;
        this.lastTriggerValue = currentTriggerValue;
        return;
      }

      if (currentTriggerValue && !this.lastTriggerValue) {
        this.show();
      } else if (!currentTriggerValue && this.lastTriggerValue) {
        this.hide();
      }

      this.lastTriggerValue = currentTriggerValue;
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
    }, this.displayDuration());
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
