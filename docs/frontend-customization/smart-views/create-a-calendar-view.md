# Create a Calendar view

![](<../../assets/imported/image (255).png>)

```javascript
import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { scheduleOnce } from '@ember/runloop';
import { action } from '@ember/object';
import { observes } from '@ember-decorators/object';
import { tracked } from '@glimmer/tracking';
import { guidFor } from '@ember/object/internals';
import $ from 'jquery';
import {
  triggerSmartAction,
  deleteRecords,
  getCollectionId,
  loadExternalStyle,
  loadExternalJavascript,
} from 'client/utils/smart-view-utils';

export default class extends Component {
  @service() router;
  @service() store;

  @tracked conditionAfter = null;
  @tracked conditionBefore = null;
  @tracked loaded = false;

  constructor(...args) {
    super(...args);

    this.loadPlugin();
  }

  @observes('records.[]')
  onRecordsChange() {
    this.setEvent();
  }

  get calendarId() {
    return `${guidFor(this)}-calendar`;
  }

  async loadPlugin() {
    loadExternalStyle('//cdnjs.cloudflare.com/ajax/libs/fullcalendar/3.1.0/fullcalendar.min.css');
    await loadExternalJavascript(
      '//cdnjs.cloudflare.com/ajax/libs/fullcalendar/3.1.0/fullcalendar.min.js',
    );
    this.loaded = true;
  }

  @action
  onInsert() {
    $(`#${this.calendarId}`).fullCalendar({
      allDaySlot: false,
      minTime: '00:00:00',
      defaultDate: new Date(2018, 2, 1),
      eventClick: (event, jsEvent, view) => {
        this.router.transitionTo(
          'project.rendering.data.collection.list.view-edit.details',
          this.args.collection.id,
          event.id,
        );
      },
      viewRender: view => {
        const field = this.args.collection.fields.findBy('field', 'start_date');

        if (this.conditionAfter) {
          this.removeCondition(this.conditionAfter, true);
          this.conditionAfter.destroyRecord();
        }
        if (this.conditionBefore) {
          this.removeCondition(this.conditionBefore, true);
          this.conditionBefore.destroyRecord();
        }

        const conditionAfter = this.store.createFragment('fragment-condition');
        conditionAfter.set('field', field);
        conditionAfter.set('operator', 'is after');
        conditionAfter.set('value', view.start);
        conditionAfter.set('smartView', this.args.viewList);
        this.set('conditionAfter', conditionAfter);

        const conditionBefore = this.store.createFragment('fragment-condition');
        conditionBefore.set('field', field);
        conditionBefore.set('operator', 'is before');
        conditionBefore.set('value', view.end);
        conditionBefore.set('smartView', this.args.viewList);
        this.set('conditionBefore', conditionBefore);

        this.addCondition(conditionAfter, true);
        this.addCondition(conditionBefore, true);

        this.args.fetchRecords({ page: 1 });
      },
    });

    this.setEvent();
  }

  setEvent() {
    if (!this.args.records) {
      return;
    }

    const calendar = $(`#${this.calendarId}`);
    calendar.fullCalendar('removeEvents');

    this.args.records.forEach(appointment => {
      const event = {
        id: appointment.get('id'),
        title: appointment.get('forest-name'),
        start: appointment.get('forest-start_date'),
        end: appointment.get('forest-end_date'),
      };

      calendar.fullCalendar('renderEvent', event, true);
    });
  }

  @action
  triggerSmartAction(...args) {
    return triggerSmartAction(this, ...args);
  }

  @action
  deleteRecords(...args) {
    return deleteRecords(this, ...args);
  }
}
```

```html
<style>
  .calendar {
    padding: 20px;
    background: var(--color-beta-surface);
    height: 100%;
    overflow: scroll;
  }
  .calendar .fc-toolbar.fc-header-toolbar .fc-left {
    font-size: 14px;
    font-weight: bold;
  }
  .calendar .fc-day-header {
    padding: 10px 0;
    background-color: var(--color-beta-secondary);
    color: var(--color-beta-on-secondary_dark);
  }
  .calendar .fc-event {
    background-color: var(--color-beta-secondary);
    border: 1px solid var(--color-beta-on-secondary_border);
    color: var(--color-beta-on-secondary_medium);
    font-size: 14px;
  }
  .calendar .fc-day-grid-event {
    background-color: var(--color-beta-info);
    color: var(--color-beta-on-info);
    font-size: 10px;
    border: none;
    padding: 2px;
  }
  .calendar .fc-day-number {
    color: var(--color-beta-on-surface_medium);
  }
  .calendar .fc-other-month .fc-day-number {
    color: var(--color-beta-on-surface_disabled);
  }
  .fc-left {
    color: var(--color-beta-on-surface_dark);
  }
</style>

<div id="{{this.calendarId}}" class="calendar" {{did-insert this.onInsert}}></div>
```
