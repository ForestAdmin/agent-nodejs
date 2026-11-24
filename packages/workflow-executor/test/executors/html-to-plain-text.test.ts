import htmlToPlainText from '../../src/executors/html-to-plain-text';

describe('htmlToPlainText', () => {
  it('turns paragraphs and list items into lines, dropping inline tags', () => {
    expect(
      htmlToPlainText(
        '<p>Refund <strong>approved</strong></p><ul><li>Send the <em>email</em></li><li>Close</li></ul>',
      ),
    ).toBe('Refund approved\nSend the email\nClose');
  });

  it('keeps the address of a link in brackets', () => {
    expect(htmlToPlainText('<p>See <a href="https://forestadmin.com">the docs</a></p>')).toBe(
      'See the docs (https://forestadmin.com)',
    );
  });

  it('keeps a link written as its own address once', () => {
    expect(
      htmlToPlainText('<p><a href="https://forestadmin.com">https://forestadmin.com</a></p>'),
    ).toBe('https://forestadmin.com');
  });

  it('decodes the entities of the HTML it turned into text', () => {
    expect(htmlToPlainText('<p>Tom &amp; Jerry &lt;3</p>')).toBe('Tom & Jerry <3');
  });

  it('turns a line break into a new line', () => {
    expect(htmlToPlainText('<p>Line one<br>Line two</p>')).toBe('Line one\nLine two');
  });

  it('leaves text without formatting tags as written', () => {
    expect(htmlToPlainText('List<String> & a < b')).toBe('List<String> & a < b');
  });

  it('keeps brackets that are not formatting tags in HTML text', () => {
    expect(htmlToPlainText('<p>Returns List<String></p>')).toBe('Returns List<String>');
  });
});
