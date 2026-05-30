// import { Component, Input } from '@angular/core';

// @Component({
//   selector: 'app-popup',
//   standalone: true,
//   templateUrl: './popup.html',
//   styleUrls: ['./popup.scss'],
// })
// export class Popup {
//   @Input() show = false;
// }

import { Component, input, signal, effect } from '@angular/core';

@Component({
  selector: 'app-popup',
  standalone: true,
  templateUrl: './popup.html',
  styleUrls: ['./popup.scss'],
})
export class Popup {
  // Das Input-Signal von außen (z.B. true, wenn der API-Call erfolgreich war)
  trigger = input<boolean>(false);

  // Interner Zustand, ob das Popup wirklich sichtbar ist
  isVisible = signal<boolean>(false);

  // Zeit in Millisekunden, wie lange das Popup offen bleibt
  private readonly DISPLAY_DURATION = 5000;
  private timeoutId: any;

  constructor() {
    // Ein Effekt reagiert automatisch, wenn sich das 'trigger'-Input ändert
    effect(() => {
      if (this.trigger()) {
        // Falls noch ein alter Timer läuft (z.B. bei schnellem Doppel-Trigger), löschen
        if (this.timeoutId) clearTimeout(this.timeoutId);

        // Popup anzeigen
        this.isVisible.set(true);

        // Nach X Sekunden automatisch wieder schließen
        this.timeoutId = setTimeout(() => {
          this.isVisible.set(false);
        }, this.DISPLAY_DURATION);
      } else {
        // Wenn von außen explizit false übergeben wird, sofort schließen
        this.isVisible.set(false);
      }
    });
  }
}
