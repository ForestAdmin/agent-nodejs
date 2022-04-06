# Create a dynamic calendar view for an event-booking use case

This example shows you how you can implement a calendar view with a custom workflow involving dynamic API calls.

{% embed url="https://1726799947-files.gitbook.io/~/files/v0/b/gitbook-28427.appspot.com/o/assets%2F-M0vHiS-1S9Hw3djvoTw%2F-MKAYvRiEvc2Y181Ejrg%2F-MKB4avHKqFFMff_67_F%2Fsmart%20view%20calendar.gif?alt=media&token=d182fc52-68d8-4631-a61c-5a4849b70d4c" %}

In our example, we want to manage the bookings for a sports court where:

- We have a list of court opening dates. Each date can be subject to a price increase if the period is busy. These dates [come from a collection](https://docs.forestadmin.com/woodshop/how-tos/create-a-custom-view#available-dates-model) called `availableDates`
- A list of available slots appears after selecting a date and duration. These available slots [come from a smart collection](https://docs.forestadmin.com/woodshop/how-tos/create-a-custom-view#available-slots-smart-collection) called `availableSlots`
- The user can book a specific slot [using a smart action](https://docs.forestadmin.com/woodshop/how-tos/create-a-custom-view#book-smart-action) called`book`.

## How it works

### Smart view definition

Learn more about [smart views](https://docs.forestadmin.com/documentation/reference-guide/views/create-and-manage-smart-views#creating-a-smart-view).\
\
**File template.hbs**

This file contains the HTML and CSS needed to build the view.

```css
.calendar {
  padding: 20px;
  background: white;
  height: 100%;
  width: 50%;
  overflow: scroll;
  color: #415574;
}
.wrapper-view {
  display: flex;
  height: 800px;
  width: 100%;
  background-color: white;
}
.right-hand-wrapper {
  width: 40%;
  padding: 3px 30px;
  background-color: white;
  margin-left: 30px;
  height: 80%;
  overflow: scroll;
}
:root {
  --fc-border-color: #e0e4e8;
  --fc-button-text-color: #415574;
  --fc-button-bg-color: #ffffff;
  --fc-button-border-color: #c8ced7;
  --fc-button-hover-bg-color: rgb(195, 195, 195);
  --fc-button-hover-border-color: #c8ced7;
  --fc-button-active-bg-color: #ffffff;
  --fc-button-active-border-color: #c8ced7;
}
.slot-container {
  display: flex;
  margin: 10px 0;
  vertical-align: center;
  padding: 2px 0;
}
.slot-value {
  margin: auto 0;
  margin-right: 30px;
  width: 40px;
}
.calendar .fc-toolbar.fc-header-toolbar .fc-left {
  font-size: 14px;
  font-weight: bold;
}
.calendar .fc-day-header {
  padding: 10px 0;
  background-color: #f7f7f7;
}
.calendar .fc-event {
  background-color: #f7f7f7;
  border: 1px solid #ddd;
  color: #555;
  font-size: 14px;
  margin-top: 5px;
}
.calendar .fc-daygrid-event {
  background-color: #a2c1f5;
  color: white;
  font-size: 14px;
  border: none;
  padding: 6px;
}
.c-beta-radio-button-duration {
  display: flex;
  margin-top: 4px;
  flex-wrap: wrap;
  margin-bottom: -4px;
}
```

```handlebars
<div class='wrapper-view'>
  <div id='{{calendarId}}' class='calendar'></div>
  <div class='right-hand-wrapper'>
    <div class='c-beta-label c-beta-label--top ember-view l-dmb'>
      <div class='c-beta-label__label'>Selected date</div>
      <div class='c-row-value'>
        {{#if this.selectedDate}}
          {{this.selectedDate}}
        {{else}}
          None
        {{/if}}
      </div>
    </div>

    <div class='c-beta-label c-beta-label--top ember-view l-dmb'>
      <div class='c-beta-label__label'>Duration</div>
      <BetaRadioButton
        @class='c-beta-radio-button-duration'
        @namePath='label'
        @options={{this.durations}}
        @value={{this.selectedDuration}}
        @valuePath='value'
      />
    </div>

    {{#if this.availableSlots}}
      <div class='c-beta-label c-beta-label--top ember-view l-dmb'>
        <div class='c-beta-label__label'>Available slots</div>
        {{#each this.availableSlots as |slot|}}
          <div class='slot-container'>
            <div class='c-row-value slot-value'>{{slot.forest-time}}</div>
            <div
              class='c-beta-button c-beta-button--primary'
              onclick={{action 'triggerSmartAction' this.availableSlotsCollection 'book' slot}}
            >book</div>
          </div>
        {{/each}}
      </div>
    {{else}}
      {{#if (not this.selectedDate)}}
        Please select a date to see slots available.
      {{else}}
        No slots available, please try another duration or another date.
      {{/if}}
    {{/if}}
  </div>
</div>
```

**File template.js**

This file contains all the logic needed to handle events and actions.

```javascript
import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { scheduleOnce } from '@ember/runloop';
import { observer } from '@ember/object';
import $ from 'jquery';
import SmartViewMixin from 'client/mixins/smart-view-mixin';

export default Component.extend(SmartViewMixin, {
  store: service(),
  conditionAfter: null,
  conditionBefore: null,
  loaded: false,
  calendarId: null,
  selectedAvailability: null,
  selectedDate: null,
  selectedDuration: 1,
  availableSlots: null,
  availableSlotsCollection: null,
  _calendar: null,

  init(...args) {
    this._super(...args);
    this.loadPlugin();
    this.initConditions();
    this.set('durations', [
      {
        label: '1 hour',
        value: 1,
      },
      {
        label: '2 hours',
        value: 2,
      },
      {
        label: '3 hours',
        value: 3,
      },
    ]);
  },

  didInsertElement() {
    this.set(
      'availableSlotsCollection',
      this.store.peekAll('collection').findBy('name', 'availableSlots'),
    );
  },

  // update displayed events when new records are retrieved
  onRecordsChange: observer('records.[]', function () {
    this.setEvent();
  }),

  onConfigurationChange: observer('selectedDate', 'selectedDuration', function () {
    this.searchAvailabilities();
  }),

  initConditions() {
    if (this.filters) {
      this.filters.forEach(condition => {
        if (condition.operator === 'is after') {
          this.set('conditionAfter', condition);
        } else if (condition.operator === 'is before') {
          this.set('conditionBefore', condition);
        }
      });
    }
  },

  loadPlugin() {
    scheduleOnce('afterRender', this, function () {
      this.set('calendarId', `${this.elementId}-calendar`);

      // retrieve fullCalendar script to build the calendar view
      $.getScript('https://cdn.jsdelivr.net/npm/fullcalendar@5.3.0/main.min.js', () => {
        this.setEvent();
        const calendarEl = document.getElementById(this.calendarId);
        const calendar = new FullCalendar.Calendar(calendarEl, {
          height: 600,
          allDaySlot: true,
          eventClick: (event, jsEvent, view) => {
            // persist the selected event information when an event is clicked
            this.set('selectedAvailability', event.event);
            const eventStart = event.event.start;
            const selectedDate = `${eventStart.getDate().toString()}/${(
              eventStart.getMonth() + 1
            ).toString()}/${eventStart.getFullYear().toString()}`;
            // persist the selected event's date to be displayed in the view
            this.set('selectedDate', selectedDate);
          },
          // define logic to be triggered when the user navigates between date ranges
          datesSet: view => {
            // define params to query the relevant records from the database based on the date range
            const params = {
              filters: JSON.stringify({
                aggregator: 'and',
                conditions: [
                  {
                    field: 'date',
                    operator: 'before',
                    value: view.end,
                  },
                  {
                    field: 'date',
                    operator: 'after',
                    value: view.start,
                  },
                ],
              }),
              'page[number]': 1,
              'page[size]': 31,
              timezone: 'Europe/Paris',
            };

            // query the records from the availableDates collection
            return this.store
              .query('forest-available-date', params)
              .then(records => {
                this.set('records', records);
              })
              .catch(error => {
                this.set('records', null);
                alert('We could not retrieve the available dates');
                console.error(error);
              });
          },
        });

        this.set('_calendar', calendar);
        calendar.render();
        this.set('loaded', true);
      });

      const headElement = document.getElementsByTagName('head')[0];
      const cssLink = document.createElement('link');

      cssLink.type = 'text/css';
      cssLink.rel = 'stylesheet';
      cssLink.href = 'https://cdn.jsdelivr.net/npm/fullcalendar@5.3.0/main.min.css';
      headElement.appendChild(cssLink);
    });
  },

  // create calendar event objects for each availableDates record
  setEvent() {
    if (!this.records || !this.loaded) {
      return;
    }

    this._calendar.getEvents().forEach(event => event.remove());

    this.records.forEach(availability => {
      if (availability.get('forest-opened') === true) {
        const event = {
          id: availability.get('id'),
          title: 'Available',
          start: availability.get('forest-date'),
          allDay: true,
        };

        if (availability.get('forest-pricingPremium') === 'high') {
          event.textColor = 'white';
          event.backgroundColor = '#FB6669';
          event.title = 'Available';
        }
        this._calendar.addEvent(event);
      }
    });
  },

  // retrieve record from the availableSlots collection when an event has been selected
  searchAvailabilities() {
    if (this.selectedAvailability) {
      return this.store
        .query('forest-available-slot', {
          date: this.selectedAvailability.start,
          duration: this.selectedDuration,
        })
        .then(slots => {
          this.set('availableSlots', slots);
        })
        .catch(error => {
          this.set('availableSlots', null);
          alert('We could not retrieve the available slots');
          console.error(error);
        });
    }
  },
});
```

### Available dates model

**File models/available-dates.js**

This file contains the model definition for the collection `availableDates`. It is located in the `models` folder, at the root of the admin backend.

```javascript
module.exports = (sequelize, DataTypes) => {
  const { Sequelize } = sequelize;
  const AvailableDates = sequelize.define(
    'availableDates',
    {
      date: {
        type: DataTypes.DATE,
      },
      opened: {
        type: DataTypes.BOOLEAN,
      },
      pricingPremium: {
        type: DataTypes.STRING,
      },
    },
    {
      tableName: 'available_dates',
      underscored: true,
      timestamps: false,
      schema: process.env.DATABASE_SCHEMA,
    },
  );

  return AvailableDates;
};
```

### Available slots smart collection

To create a smart collection that returns records built from an API call, two files need to be created:

- a file `available-slots.js` inside the folder `forest` to declare the collection
- a file `available-slots.js` inside the `routes` folder to implement the `GET` logic for the collection

**File forest/available-slots.js**

This file includes the smart collection definition.

```javascript
const { collection } = require('forest-express-sequelize');

collection('availableSlots', {
  fields: [
    {
      field: 'startDate',
      type: 'Date',
    },
    {
      field: 'endDate',
      type: 'Date',
    },
    {
      field: 'time',
      type: 'String',
    },
    {
      field: 'maxTimeSlot',
      type: 'Number',
    },
  ],
  segments: [],
});
```

**File routes/available-slots.js**

This file includes the logic implemented to retrieve the available slots from an API call and return them serialized to the UI.

```javascript
const express = require('express');
const { PermissionMiddlewareCreator, RecordSerializer } = require('forest-express-sequelize');
const { availableSlots } = require('../models');

const router = express.Router();
const permissionMiddlewareCreator = new PermissionMiddlewareCreator('availableSlots');
const recordSerializer = new RecordSerializer({ name: 'availableSlots' });

// Get a list of Available slots
router.get('/availableSlots', permissionMiddlewareCreator.list(), (request, response, next) => {
  const { date } = request.query;
  const { duration } = request.query;
  return fetch(`https://apicallplaceholder/slots/?date=${date}&duration=${duration}`)
    .then(response => JSON.parse(response))
    .then(matchingSlots => {
      return recordSerializer
        .serialize(matchingSlots)
        .then(recordsSerialized => response.send(recordsSerialized));
    })
    .catch(error => {
      console.error(error);
    });
});

module.exports = router;
```

### Book smart action

To create the action to book a slot, two files need to be updated:

- the file `available-slots.js` inside the folder `forest` to declare the action
- the file `available-slots.js` inside the `routes` folder to implement the logic for the action

**File forest/available-slots.js**

This file includes the smart action definition. The action form is pre-filled with the start and end date. The last step is to select the user associated with this booking.

```javascript
const { collection } = require('forest-express-sequelize');

collection('availableSlots', {
  actions: [
    {
      name: 'book',
      type: 'single',
      fields: [{
        field: 'start date',
        type: 'Date',
      }, {
        field: 'end date',
        type: 'Date',
      }, {
        field: 'user',
        reference: 'users.id',
      }],
      values: (context) => {
        return {
          'start date': context.startDate,
          'end date': context.endDate,
        };
      },
    },
  ],
...
});

```

**File routes/available-slots.js**

This file includes the logic of the smart action. It basically creates a record from the `bookings` collection with the information passed on by the user input form.

```javascript
const express = require('express');
const { PermissionMiddlewareCreator } = require('forest-express-sequelize');
const { bookings } = require('../models');

const router = express.Router();
const permissionMiddlewareCreator = new PermissionMiddlewareCreator('availableSlots');

...
router.post('/actions/book', permissionMiddlewareCreator.smartAction(), (request, response) => {
  const attr = request.body.data.attributes.values;
  const startDate = attr['start date'];
  const endDate = attr['end date'];
  bookings.create({
    startDate,
    endDate,
    userIdKey: attr.user,
  }).then(() => response.send({ success: 'successfully created booking' }));
});


module.exports = router;
```
