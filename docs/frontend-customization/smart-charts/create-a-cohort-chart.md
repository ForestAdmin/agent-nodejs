![](https://gblobscdn.gitbook.com/assets%2F-LR7SWfEwsNtj_ZiSkSA%2F-McF5Q19wi4K5nGRWsEw%2F-McF5ZgR_CzOBdpKh9Xe%2FCleanShot%202021-06-15%20at%2016.36.24%402x.png?alt=media&token=16334b60-fcf8-4e02-8a36-605a4fea4e7c)

This is another example to help you build a Cohort Chart.

{% code title="Template tab" %}

```html
<div class="c-smart-chart">
  <div id="demo"></div>
</div>
```

{% endcode %}

{% code title="Component tab" %}

```javascript
import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { loadExternalStyle, loadExternalJavascript } from 'client/utils/smart-view-utils';

function isValidHex(color) {
  return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(color);
}

function shadeColor(color, percent) {
  //#
  color = isValidHex(color) ? color : '#3f83a3'; //handling null color;
  percent = 1.0 - Math.ceil(percent / 10) / 10;
  var f = parseInt(color.slice(1), 16),
    t = percent < 0 ? 0 : 255,
    p = percent < 0 ? percent * -1 : percent,
    R = f >> 16,
    G = (f >> 8) & 0x00ff,
    B = f & 0x0000ff;
  return (
    '#' +
    (
      0x1000000 +
      (Math.round((t - R) * p) + R) * 0x10000 +
      (Math.round((t - G) * p) + G) * 0x100 +
      (Math.round((t - B) * p) + B)
    )
      .toString(16)
      .slice(1)
  );
}

export default class extends Component {
  @service lianaServerFetch;
  @tracked loaging = true;
  constructor(...args) {
    super(...args);
    this.loadPlugin();
  }
  async loadPlugin() {
    await loadExternalJavascript('https://d3js.org/d3.v6.min.js');
    this.loaging = false;
    this.renderChart();
  }
  getRows(data) {
    var rows = [];
    var keys = Object.keys(data);
    var days = [];
    var percentDays = [];
    for (var key in keys) {
      if (data.hasOwnProperty(keys[key])) {
        days = data[keys[key]];
        percentDays.push(keys[key]);
        for (var i = 0; i < days.length; i++) {
          percentDays.push(i > 0 ? Math.round((days[i] / days[0]) * 100 * 100) / 100 : days[i]);
        }
        rows.push(percentDays);
        percentDays = [];
      }
    }
    return rows;
  }
  @action
  async renderChart() {
    // To fetch data from the backend
    // const data = await this.lianaServerFetch.fetch('/forest/custom-route', {});
    const options = {
      data: {
        // You can use any data format, just change the getRows logic
        'May 3, 2021': [79, 18, 16, 12, 16, 11, 7, 5],
        'May 10, 2021': [168, 35, 28, 30, 24, 12, 10],
        'May 17, 2021': [188, 42, 32, 34, 25, 18],
        'May 24, 2021': [191, 42, 32, 28, 12],
        'May 31, 2021': [191, 45, 34, 30],
        'June 7, 2021': [184, 42, 32],
        'June 14, 2021': [182, 44],
      },
      title: 'Retention rates by weeks after signup',
    };
    var graphTitle = options.title || 'Retention Graph';
    var data = options.data || null;
    const container = d3.select('#demo').append('div').attr('class', 'box');
    var header = container.append('div').attr('class', 'box-header with-border');
    var title = header.append('p').attr('class', 'box-title').text(graphTitle);
    var body = container.append('div').attr('class', 'box-body');
    var table = body.append('table').attr('class', 'table table-bordered text-center');
    var headData = ['Cohort', 'New users', '1', '2', '3', '4', '5', '6', '7'];
    var tHead = table
      .append('thead')
      .append('tr')
      .attr('class', 'retention-thead')
      .selectAll('td')
      .data(headData)
      .enter()
      .append('td')
      .attr('class', function (d, i) {
        if (i == 0) return 'retention-date';
        else return 'days';
      })
      .text(function (d) {
        return d;
      });
    var rowsData = this.getRows(data);
    var tBody = table.append('tbody');
    var rows = tBody.selectAll('tr').data(rowsData).enter().append('tr');
    var cells = rows
      .selectAll('td')
      .data(function (row, i) {
        return row;
      })
      .enter()
      .append('td')
      .attr('class', function (d, i) {
        if (i == 0) return 'retention-date';
        else return 'days';
      })
      .attr('style', function (d, i) {
        if (i > 1) return 'background-color :' + shadeColor('#00c4b4', d);
      })
      .append('div')
      .attr('data-toggle', 'tooltip')
      .text(function (d, i) {
        return d + (i > 1 ? '%' : '');
      });
  }
}
```

{% endcode %}

In the above snippet, notice how we import the **D3js** library. Of course, you can choose to use any other library of your choice.

{% code title="Style tab" %}

```css
.c-smart-chart {
  display: flex;
  white-space: normal;
  bottom: 0;
  left: 0;
  right: 0;
  top: 0;
  background-color: var(--color-beta-surface);
}
.box {
  position: relative;
  border-radius: 3px;
  background: #ffffff;
  width: 100%;
}
.box-body {
  max-height: 500px;
  overflow: auto;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 3px;
  border-bottom-left-radius: 3px;
}
.box-header {
  color: #444;
  display: block;
  padding: 10px;
  position: relative;
}
.box-header .box-title {
  display: inline-block;
  font-size: 18px;
  margin: 0;
  line-height: 1;
}
.box-title {
  display: inline-block;
  font-size: 18px;
  margin: 0;
  line-height: 1;
}
.retention-thead,
.retention-date {
  background-color: #cfcfcf;
  font-weight: 700;
  padding: 8px;
}
.days {
  cursor: pointer;
  padding: 8px;
  text-align: center;
}
```

{% endcode %}

The resulting chart can be resized to fit your use.
