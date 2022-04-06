# Create a Shipping view

![](../../assets/smart-view-shipping.png)

{% code title="component.js" %}

```javascript
import Component from '@glimmer/component';
import { action, computed } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { guidFor } from '@ember/object/internals';
import {
  triggerSmartAction,
  deleteRecords,
  getCollectionId,
  loadExternalStyle,
  loadExternalJavascript,
} from 'client/utils/smart-view-utils';

export default class extends Component {
  @tracked currentRecord = null;

  get status() {
    switch (this.currentRecord?.get('forest-shipping_status')) {
      case 'Being processed':
        return 'one';
      case 'Ready for shipping':
        return 'two';
      case 'In transit':
        return 'three';
      case 'Shipped':
        return 'four';
      default:
        return null;
    }
  }

  @action
  setDefaultCurrentRecord() {
    if (!this.currentRecord) {
      this.currentRecord = this.args.records.firstObject;
    }
  }

  @action
  selectRecord(record) {
    this.currentRecord = record;
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

{% endcode %}

{% code title="style.css" %}

```css
/* Wrapper styles */
.wrapper-view {
  background: #f2f6fa;
  width: 100%;
  display: flex;
  border: 1px solid #f2f6fa;
  border-radius: 5px;
}
.wrapper-list {
  min-width: 330px;
  height: 100vh;
  background: #f2f6fa;
  border-right: 1px solid #d9dde1;
  overflow: scroll;
}
.wrapper-card {
  width: 100%;
  margin: 30px;
  background: #fff;
  padding: 20px;
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  -moz-border-radius: 4px;
  -webkit-border-radius: 4px;
  box-shadow: 0 0 2px 0 rgba(0, 0, 0, 0.15);
  -moz-box-shadow: 0 0 2px 0 rgba(0, 0, 0, 0.15);
  -webkit-box-shadow: 0 0 2px 0 rgba(0, 0, 0, 0.15);
}
/* List styles */
.list--header {
  background: #fff;
  padding: 14px 30px;
  height: 66px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #d9dde1;
}
form {
}
form.list-options {
  align-self: center;
}
form.list-options select {
  background: #f2f6fa;
  border: 1px solid #adb8c6;
  width: 167px;
  height: 38px;
  font-size: 14px;
  padding: 14px;
}
a {
  text-decoration: none;
}
.list--item {
  background: #fff;
  border-bottom: 1px solid #d9dde1;
  display: flex;
  flex-flow: row wrap;
  justify-content: space-between;
  background: #fff;
  padding: 14px 30px;
  position: relative;
}
/* use this 'selected' to show selected color */
.list--item.selected::before {
  content: '';
  width: 4px;
  height: 100%;
  margin: 0;
  padding: 0;
  background: #7a6adc;
  position: absolute;
  top: 0;
  left: 0;
}
.list--item__values-left {
  color: #647a93;
}
.list--item__values-left h3 {
  font-size: 14px;
  font-weight: bold;
  padding: 2px 0;
}
.list--item__values-left h3 span {
  font-size: 10px;
  text-transform: uppercase;
}
.list--item__values-left p {
  font-size: 10px;
  padding: 2px 0;
}
.list--item__values-left p span {
  text-transform: uppercase;
}
.list--item__values-right {
  display: flex;
  align-items: center;
  justify-content: center;
}
.list--item__values-right p {
  color: #647a93;
  font-size: 10px;
  align-self: flex-start;
  padding: 2px 0;
  margin: 0;
}
/* Card styles */
.card--title {
  padding: 0;
  margin-bottom: 40px;
}
.card--title h2 {
  margin: 0;
  padding: 0;
  color: #303b47;
}
.card--title small {
  margin: 0;
  padding: 0;
}
.card--gaugebar {
  display: flex;
  flex-flow: row wrap;
  width: 100%;
}
.gaugebar {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 40px;
}
.gaugebar--points {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  height: 50px;
}
.gaugebar--points img {
  width: 42px;
  margin: 0 10px;
}
.gaugebar--points__information {
  font-size: 12px;
  margin: 0;
  height: 50px;
}
.gaugebar--points__informations p {
  max-width: 370px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gaugebar--bar {
  background: #f2f6fa;
  height: 30px;
  width: 100%;
  margin: 0;
  padding: 0;
  position: relative;
  border-radius: 100px;
  -moz-border-radius: 100px;
  -webkit-border-radius: 100px;
}
.gaugebar--bar__active {
  background: #54bd7e;
  position: absolute;
  top: 0;
  left: 0;
  width: 50%;
  height: 30px;
  transition: all 900ms ease;
  border-radius: 100px;
  -moz-border-radius: 100px;
  -webkit-border-radius: 100px;
}
.gaugebar--bar__active.one {
  width: 5%;
  transition: all 900ms ease;
}
.gaugebar--bar__active.two {
  width: 45%;
  transition: all 900ms ease;
}
.gaugebar--bar__active.three {
  width: 80%;
  transition: all 900ms ease;
}
.gaugebar--bar__active.four {
  width: 100%;
  transition: all 900ms ease;
}
.gaugebar--bar__active.four::after {
  content: 'DELIVERED';
  position: absolute;
  top: -50%;
  right: 0;
  font-size: 12px;
  transition: all 900ms ease;
}
.gaugebar--bar__active::before {
  content: '';
  background: #459565;
  width: 30px;
  height: 30px;
  position: absolute;
  right: 0;
  border-radius: 50%;
  -moz-border-radius: 50%;
  -webkit-border-radius: 50%;
}
.gaugebar--informations {
  width: 100%;
  display: flex;
  flex-flow: row wrap;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}
.gaugebar--informations__start p,
.gaugebar--informations__middle p,
.gaugebar--informations__end p {
  text-transform: uppercase;
  font-size: 10px;
}
.gaugebar--informations__end p {
  text-align: right;
}
.green {
  color: #54bd7e;
}
.gaugebar--error {
  background: #fff;
  border-radius: 4px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  margin-top: 30px;
  box-shadow: 0 0 2px 0 rgba(0, 0, 0, 0.15);
  -moz-box-shadow: 0 0 2px 0 rgba(0, 0, 0, 0.15);
  -webkit-box-shadow: 0 0 2px 0 rgba(0, 0, 0, 0.15);
}
.gaugebar--error p {
  font-size: 14px;
  color: #899aad;
  margin-bottom: 10px;
}
.gaugebar--error p.error {
  color: #ff9a76;
  text-transform: uppercase;
}
.gaugebar--error a.btn {
  color: #fff;
  padding: 8px 24px;
  border-radius: 2px;
}
.gaugebar--error a.btn-info {
  background: #3789e4;
}
.gaugebar--error a.btn-info:hover {
  background: #287bd8;
  transition: all 900ms ease;
}
```

{% endcode %}

{% code title="template.hbs" %}

```handlebars
<div class='wrapper-view' {{did-insert this.setDefaultCurrentRecord}}>
  <div class='wrapper-list'>
    {{#each @records as |record|}}
      <a href='#' {{on 'click' (fn this.selectRecord record)}}>
        <div class='list--item {{if (eq this.currentRecord record) "selected"}}'>
          <div class='list--item__values-left'>
            <h3><span>to :</span>
              {{record.forest-customer.forest-firstname}}
              {{record.forest-customer.forest-lastname}}</h3>
            <p><span>order ID</span> : {{record.id}}</p>
            <p><span>status</span> : {{record.forest-shipping_status}}</p>
          </div>
          <div class='list--item__values-right'>
            <p>{{moment-format record.forest-created_at 'LLL'}}</p>
          </div>
        </div>
      </a>
    {{/each}}
  </div>
  <div class='wrapper-card'>
    <div class='card--title'>
      <h2>Order to
        {{this.currentRecord.forest-customer.forest-firstname}}
        {{this.currentRecord.forest-customer.forest-lastname}}</h2>
      <small>ID: {{this.currentRecord.id}}</small>
    </div>
    <div class='card--gaugebar'>
      <div class='gaugebar'>
        <div class='gaugebar--points'>
          <img src={{this.currentRecord.forest-product.forest-picture}} alt='' />
          <div class='gaugebar--points__informations'>
            <p>Product: {{this.currentRecord.forest-product.forest-label}}</p>
            <p>Customer:
              {{this.currentRecord.forest-customer.forest-firstname}}
              {{this.currentRecord.forest-customer.forest-lastname}}</p>
          </div>
        </div>
      </div>
      <div class='gaugebar--bar'>
        <!-- use class 'full' to show full bar with order delivered -->
        <div class='gaugebar--bar__active {{this.status}}'></div>
      </div>
      <div class='gaugebar--informations'>
        <div class='gaugebar--informations__one green'>
          <p>Being processed</p>
          <p>{{moment-format this.currentRecord.forest-being_processed_at 'LLL'}}</p>
        </div>
        <div
          class='gaugebar--informations__two
            {{if this.currentRecord.forest-ready_for_shipping_at "green"}}'
        >
          <p>Ready for shipping</p>
          {{#if this.currentRecord.forest-ready_for_shipping_at}}
            <p>{{moment-format this.currentRecord.forest-ready_for_shipping_at 'LLL'}}</p>
          {{/if}}
        </div>
        <div
          class='gaugebar--informations__three
            {{if this.currentRecord.forest-in_transit_at "green"}}'
        >
          <p>In transit</p>
          {{#if this.currentRecord.forest-in_transit_at}}
            <p>{{moment-format this.currentRecord.forest-in_transit_at 'LLL'}}</p>
          {{/if}}
        </div>
        <div
          class='gaugebar--informations__four {{if this.currentRecord.forest-shipped_at "green"}}'
        >
          <p>Shipped</p>
          {{#if this.currentRecord.forest-shipped_at}}
            <p>{{moment-format this.currentRecord.forest-shipped_at 'LLL'}}</p>
          {{/if}}
        </div>
      </div>
    </div>
  </div>
</div>
```

{% endcode %}
