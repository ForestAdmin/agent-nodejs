# Create a Gallery view

![](<../../assets/imported/image (256).png>)

{% tabs %}
{% tab title="Ember" %}
{% code title="Component" %}

```javascript
import Component from '@glimmer/component';
import { action } from '@ember/object';
import {
  triggerSmartAction,
  deleteRecords,
  getCollectionId,
  loadExternalStyle,
  loadExternalJavascript,
} from 'client/utils/smart-view-utils';

export default class extends Component {
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
{% endtab %}

{% tab title="React" %}
{% code title="Component" %}

```jsx
import React from 'react';
import WithEmberSupport from 'ember-react-components';
​
@WithEmberSupport
export default class extends React.Component {
  render() {
    const {
      records,
      collection,
      numberOfPages,
      recordsCount,
      currentPage,
      searchValue,
      isLoading,
      fetchRecords,
    } = this.props;
​
    const goBack = () => {
      if (currentPage > 1) {
        return fetchRecords({ page: currentPage - 1 })
      }
    };
    const goNext = () => {
      if (currentPage < numberOfPages) {
        return fetchRecords({ page: currentPage + 1 })
      }
​
    };
​
    return (
      <div className="l-gallery-view-container">
        <section className="c-gallery">
          {records.map(record => {
            const models = [collection.id, record.id];
            const baseUrl = window.location.href.split('/').slice(3, 7);
            return (
              <a href={`/${baseUrl.join('/')}/${collection.id}/index/record/${collection.id}/${record.id}/details`}
                className="c-gallery__image-container"
                key={record.id}
              >
                <img className="c-gallery__image" src={record['forest-picture']}/>
              </a>
            );
          })
          }
        </section>

        <div className="c-gallery-footer">
          <div className="c-beta-paginator">
            <div className="c-beta-paginator__left" onClick={goBack} role="button">
              <i className="material-icons c-beta-paginator__chevron c-beta-paginator__chevron--left">keyboard_arrow_left</i>
            </div>

            <span className="c-beta-paginator__separator"/>

            <div data-test-input-for="count" className="c-beta-paginator__count">{currentPage} of {numberOfPages}</div>

            <span className="c-beta-paginator__separator"/>

            <div className="c-beta-paginator__right" onClick={goNext} role="button">
              <i className="material-icons c-beta-paginator__chevron c-beta-paginator__chevron--right">keyboard_arrow_right</i>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
```

{% endcode %}
{% endtab %}
{% endtabs %}

{% tabs %}
{% tab title="Ember" %}
{% code title="Style" %}

```css
.l-gallery-view-container {
  flex-grow: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}
.c-gallery {
  padding: 15px;
  overflow-y: auto;
  width: 100%;
  position: absolute;
  left: 0;
  top: 0;
  bottom: 40px;
}
.c-gallery__image {
  height: 182px;
  width: 182px;
  margin: 3px;
  border: 1px solid var(--color-beta-on-surface_border);
  border-radius: 3px;
  transition: all 0.3s ease-out;
}
.c-gallery__image:hover {
  transform: scale(1.05);
}
```

{% endcode %}
{% endtab %}

{% tab title="React" %}
{% code title="Style" %}

```css
.l-gallery-view-container {
  flex-grow: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}
.c-gallery {
  padding: 15px;
  overflow-y: auto;
  width: 100%;
  position: absolute;
  left: 0;
  top: 0;
  bottom: 40px;
}
.c-gallery__image {
  height: 182px;
  width: 182px;
  margin: 3px;
  border: 1px solid var(--color-beta-on-surface_border);
  border-radius: 3px;
  transition: all 0.3s ease-out;
}
.c-gallery__image:hover {
  transform: scale(1.05);
}
​ .c-gallery-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 40px;
  background-color: var(--color-beta-surface);
  display: flex;
  flex-direction: row;
  align-items: center;
  border-top-width: 1px;
  border-top-style: solid;
  border-top-color: var(--color-beta-on-surface_border);
  border-radius: 0px 0px 4px 4px;
  justify-content: center;
}
```

{% endcode %}
{% endtab %}
{% endtabs %}

{% tabs %}
{% tab title="Ember" %}
{% code title="Template" %}

```html
<div class="l-gallery-view-container">
  <section class="c-gallery">
    {{#each @records as |record|}}
    <LinkTo
      @route="project.rendering.data.collection.list.view-edit.details"
      @models="{{array"
      @collection.id
      record.id}}
      class="c-gallery__image-container"
    >
      <img class="c-gallery__image" src="{{record.forest-picture}}" />
    </LinkTo>
    {{/each}}
  </section>

  <Table::TableFooter
    @collection="{{@collection}}"
    @viewList="{{@viewList}}"
    @records="{{@records}}"
    @currentPage="{{@currentPage}}"
    @numberOfPages="{{@numberOfPages}}"
    @recordsCount="{{@recordsCount}}"
    @isLoading="{{@isLoading}}"
    @fetchRecords="{{@fetchRecords}}"
  />
</div>
```

{% endcode %}
{% endtab %}
{% endtabs %}
