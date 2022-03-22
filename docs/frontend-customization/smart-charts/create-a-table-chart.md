![](https://gblobscdn.gitbook.com/assets%2F-LR7SWfEwsNtj_ZiSkSA%2F-MZlcxPrcf9vT9ernMNV%2F-MZlfjh4XS7ZQIc32yNd%2Fimage.png?alt=media&token=06de6b9b-bbeb-4af9-be93-5fb5ea1f171d)

Our first Smart Chart example will be a simple table: however you may choose to make it as complex and customized as you wish.

{% code title="" %}

```html
<BetaTable
  @columns={{array 'Username' 'Points'}}
  @rows={{this.users}}
  @alignColumnLeft={{true}}
  as |RowColumn user|
>
  <RowColumn>
    <span>{{user.username}}</span>
  </RowColumn>
  <RowColumn>
    <span>{{user.points}}</span>
  </RowColumn>
</BetaTable>
```

{% endcode %}

Using a trivial set of hardcoded data for example's sake:

{% code title="Component tab" %}

```javascript
import Component from '@glimmer/component';
import { loadExternalStyle, loadExternalJavascript } from 'client/utils/smart-view-utils';

export default class extends Component {
  users = [
    {
      username: 'Darth Vador',
      points: 1500000,
    },
    {
      username: 'Luke Skywalker',
      points: 2,
    },
  ];
}
```

{% endcode %}

To query a custom route of your Forest server as your datasource, you may use this syntax instead:

{% code title="Component tab" %}

```javascript
import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class extends Component {
  @service lianaServerFetch;

  @tracked users;

  constructor(...args) {
    super(...args);
    this.fetchData();
  }

  async fetchData() {
    const response = await this.lianaServerFetch.fetch('/forest/custom-data', {});
    this.users = await response.json();
  }
}
```

{% endcode %}
