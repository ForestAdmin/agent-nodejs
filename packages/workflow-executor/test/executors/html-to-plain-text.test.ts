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

  it('keeps a type parameter named like a formatting tag in upper case', () => {
    expect(htmlToPlainText('<p>Returns Option<A> of Props<P></p>')).toBe(
      'Returns Option<A> of Props<P>',
    );
  });

  it('turns headings, quotes and ordered list items into lines, dropping strikethrough', () => {
    expect(
      htmlToPlainText(
        '<h2>Title</h2><blockquote>Quote</blockquote><ol><li>One</li></ol><p><s>old</s> new</p>',
      ),
    ).toBe('Title\nQuote\nOne\nold new');
  });

  it('collapses the blank lines left by empty paragraphs and trailing line breaks', () => {
    expect(htmlToPlainText('<p>a</p><p></p><p>b<br></p>')).toBe('a\nb');
  });

  it('decodes every supported entity once', () => {
    expect(htmlToPlainText('<p>a&nbsp;b &quot;c&quot; it&#39;s &gt; &amp;lt;</p>')).toBe(
      'a b "c" it\'s > &lt;',
    );
  });

  it('keeps the address of a link written with single quotes', () => {
    expect(htmlToPlainText("<p><a href='https://forestadmin.com'>Pay</a></p>")).toBe(
      'Pay (https://forestadmin.com)',
    );
  });

  it('keeps the address of a link whose text spans several lines', () => {
    expect(htmlToPlainText('<p><a href="https://forestadmin.com">Pay\nnow</a></p>')).toBe(
      'Pay\nnow (https://forestadmin.com)',
    );
  });

  it('keeps a formatted link written as its own address once', () => {
    expect(
      htmlToPlainText(
        '<p><a href="https://forestadmin.com"><em>https://forestadmin.com</em></a></p>',
      ),
    ).toBe('https://forestadmin.com');
  });

  it('keeps a lower-case generic type in HTML text', () => {
    expect(htmlToPlainText('<p>Returns <strong>Array<string></strong> for <name></p>')).toBe(
      'Returns Array<string> for <name>',
    );
  });

  it('puts a nested list and the text before a list on their own lines', () => {
    expect(
      htmlToPlainText('Steps:<ul><li>Tasks<ul><li>Refund</li><li>Notify</li></ul></li></ul>'),
    ).toBe('Steps:\nTasks\nRefund\nNotify');
  });

  it('reads thousands of unclosed tags in linear time', () => {
    const unclosedTags = `<p>x</p>${'<a href="'.repeat(4000)}${'<p '.repeat(4000)}`;
    const start = Date.now();

    htmlToPlainText(unclosedTags);

    expect(Date.now() - start).toBeLessThan(500);
  });

  it('keeps HTML holding tags a Guidance response does not use as written', () => {
    const html = '<div style="color: red"><p>Hi</p><table><tr><td>Total</td></tr></table></div>';

    expect(htmlToPlainText(html)).toBe(html);
  });
});
