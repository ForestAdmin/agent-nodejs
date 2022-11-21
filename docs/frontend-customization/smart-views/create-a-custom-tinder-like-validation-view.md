This example shows you how you can implement a time-saving profile validation view using keyboard keys to trigger approve/reject actions.

{% embed url="../../assets/smart-view-tinder.mp4" %}

In our example, we want to Approve or Reject new customers profiles and more specifically:

- We want to preview information from the user's profile
- We want to approve a customer by pressing the ArrowRight key
- We want to reject a customer by pressing the ArrowLeft key

## How it works

### Models definition

Here is the definition of the underlying model for this view

```javascript
module.exports = (sequelize, DataTypes) => {
  const { Sequelize } = sequelize;
  const customerValidations = sequelize.define(
    'customerValidations',
    {
      firstname: {
        type: DataTypes.STRING,
      },
      lastname: {
        type: DataTypes.STRING,
      },
      email: {
        type: DataTypes.STRING,
      },
      createdAt: {
        type: DataTypes.DATE,
      },
      status: {
        type: DataTypes.STRING,
      },
      avatar: {
        type: DataTypes.STRING,
      },
    },
    {
      tableName: 'customers',
      underscored: true,
      schema: process.env.DATABASE_SCHEMA,
    },
  );

  return customerValidations;
};
```

### Smart view definition

This file contains the HTML, JS, and CSS needed to build the view.

{% tabs %}
{% tab title="Template" %}

```handlebars
<div class='c-smart-view'>
  <div class='c-smart-view__content'>
    {{#if (eq @recordsCount 0)}}
      <span class='c-smart-view_icon fa fa-{{@collection.iconOrDefault}} fa-5x'></span>
      <h1>
        {{@collection.pluralizedDisplayName}}
      </h1>
      <p>
        There are no items to process.
      </p>
    {{/if}}
    {{#unless (eq @recordsCount 0)}}
      <div class='wrapper-view' {{did-insert this.setDefaultCurrentRecord}}>
        <div class='wrapper-list'>
          {{#each @records as |record|}}
            <div class='list--item align-left {{if (eq @records.firstObject record) "selected"}}'>
              <div class='list--item__values'>
                <h3><span>name :</span> {{record.forest-firstname}} {{record.forest-lastname}}</h3>
                <p><span>email :</span> {{record.forest-email}}</p>
                <p>{{moment-format record.forest-createdAt 'LLL'}}</p>
              </div>
            </div>
          {{/each}}
        </div>
        <div class='wrapper-content'>
          <h1>
            {{@recordsCount}}
            items to process
          </h1>
          <p>
            Press
            <i class='fa fa-arrow-right'></i>
            to approve
          </p>
          <p>
            Press
            <i class='fa fa-arrow-left'></i>
            to reject
          </p>
          <div class='record-container'>
            <div class='c-beta-label c-beta-label--top ember-view l-dmb'>
              <div class='c-beta-label__label'>Name</div>
              <p class='c-row-value align-left'>{{@records.firstObject.forest-firstname}}
                {{@records.firstObject.forest-lastname}}</p>
            </div>
            <div class='c-beta-label c-beta-label--top ember-view l-dmb'>
              <div class='c-beta-label__label'>Email</div>
              <p class='c-row-value align-left'>{{@records.firstObject.forest-email}}</p>
            </div>
            <div class='row-value-image'>
              <img src='{{@records.firstObject.forest-avatar}}' width='300' height='400' />
            </div>
            <div
              class='c-beta-button c-beta-button--secondary'
              onclick={{action 'triggerSmartAction' @collection 'reject' @records.firstObject}}
            >Reject</div>
            <div
              class='c-beta-button c-beta-button--primary'
              onclick={{action 'triggerSmartAction' @collection 'approve' @records.firstObject}}
            >Approve</div>
          </div>
        </div>
      </div>
    {{/unless}}
  </div>
</div>
```

{% endtab %}
{% endtabs %}
