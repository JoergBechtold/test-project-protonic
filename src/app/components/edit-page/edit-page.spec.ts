import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditPageComponent } from './edit-page';

describe('EditPageComponent', () => {
  let component: EditPageComponent;
  let fixture: ComponentFixture<EditPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditPageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EditPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
