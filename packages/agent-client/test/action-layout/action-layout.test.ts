import type { ForestServerActionFormLayoutElement } from '@forestadmin/forestadmin-client';

import ActionLayoutElement from '../../src/action-layout/action-layout-element';
import ActionLayoutInput from '../../src/action-layout/action-layout-input';
import ActionLayoutPage from '../../src/action-layout/action-layout-page';
import ActionLayoutRoot from '../../src/action-layout/action-layout-root';
import { NotFoundElementError, NotRightElementError } from '../../src/action-layout/errors';

describe('Action Layout', () => {
  describe('NotFoundElementError', () => {
    it('should create error with element index', () => {
      const error = new NotFoundElementError(5);
      expect(error.message).toBe('Element 5 not found');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('NotRightElementError', () => {
    it('should create error with expected and actual element type', () => {
      const element = { component: 'input' } as ForestServerActionFormLayoutElement;
      const error = new NotRightElementError('a page', element);
      expect(error.message).toBe("This is not a page, it's a input element");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('ActionLayoutInput', () => {
    it('should return the field id', () => {
      const layoutItem = { component: 'input', fieldId: 'myField' } as any;
      const input = new ActionLayoutInput(layoutItem);

      expect(input.getInputId()).toBe('myField');
    });
  });

  describe('ActionLayoutElement', () => {
    describe('isRow', () => {
      it('should return true for row component', () => {
        const element = new ActionLayoutElement({ component: 'row', fields: [] } as any);
        expect(element.isRow()).toBe(true);
      });

      it('should return false for non-row component', () => {
        const element = new ActionLayoutElement({ component: 'input', fieldId: 'test' } as any);
        expect(element.isRow()).toBe(false);
      });
    });

    describe('isInput', () => {
      it('should return true for input component', () => {
        const element = new ActionLayoutElement({ component: 'input', fieldId: 'test' } as any);
        expect(element.isInput()).toBe(true);
      });

      it('should return false for non-input component', () => {
        const element = new ActionLayoutElement({ component: 'separator' } as any);
        expect(element.isInput()).toBe(false);
      });
    });

    describe('isHTMLBlock', () => {
      it('should return true for htmlBlock component', () => {
        const element = new ActionLayoutElement({
          component: 'htmlBlock',
          content: '<p>Hello</p>',
        } as any);
        expect(element.isHTMLBlock()).toBe(true);
      });

      it('should return false for non-htmlBlock component', () => {
        const element = new ActionLayoutElement({ component: 'input', fieldId: 'test' } as any);
        expect(element.isHTMLBlock()).toBe(false);
      });
    });

    describe('isSeparator', () => {
      it('should return true for separator component', () => {
        const element = new ActionLayoutElement({ component: 'separator' } as any);
        expect(element.isSeparator()).toBe(true);
      });

      it('should return false for non-separator component', () => {
        const element = new ActionLayoutElement({ component: 'input', fieldId: 'test' } as any);
        expect(element.isSeparator()).toBe(false);
      });
    });

    describe('getHtmlBlockContent', () => {
      it('should return html content for htmlBlock', () => {
        const htmlContent = '<div><strong>Important</strong></div>';
        const element = new ActionLayoutElement({
          component: 'htmlBlock',
          content: htmlContent,
        } as any);

        expect(element.getHtmlBlockContent()).toBe(htmlContent);
      });

      it('should throw error when element is not htmlBlock', () => {
        const element = new ActionLayoutElement({ component: 'input', fieldId: 'test' } as any);

        expect(() => element.getHtmlBlockContent()).toThrow(NotRightElementError);
        expect(() => element.getHtmlBlockContent()).toThrow(
          "This is not an htmlBlock, it's a input element",
        );
      });
    });

    describe('getInputId', () => {
      it('should return field id for input element', () => {
        const element = new ActionLayoutElement({
          component: 'input',
          fieldId: 'email',
        } as any);

        expect(element.getInputId()).toBe('email');
      });

      it('should throw error when element is not input', () => {
        const element = new ActionLayoutElement({ component: 'separator' } as any);

        expect(() => element.getInputId()).toThrow(NotRightElementError);
        expect(() => element.getInputId()).toThrow(
          "This is not an input, it's a separator element",
        );
      });
    });

    describe('rowElement', () => {
      it('should return input from row at specified index', () => {
        const element = new ActionLayoutElement({
          component: 'row',
          fields: [
            { component: 'input', fieldId: 'field1' },
            { component: 'input', fieldId: 'field2' },
          ],
        } as any);

        const input = element.rowElement(1);
        expect(input.getInputId()).toBe('field2');
      });

      it('should throw error when index is out of bounds', () => {
        const element = new ActionLayoutElement({
          component: 'row',
          fields: [{ component: 'input', fieldId: 'field1' }],
        } as any);

        expect(() => element.rowElement(5)).toThrow(NotFoundElementError);
      });

      it('should throw error when index is negative', () => {
        const element = new ActionLayoutElement({
          component: 'row',
          fields: [{ component: 'input', fieldId: 'field1' }],
        } as any);

        expect(() => element.rowElement(-1)).toThrow(NotFoundElementError);
      });

      it('should throw error when element is not a row', () => {
        const element = new ActionLayoutElement({
          component: 'input',
          fieldId: 'test',
        } as any);

        expect(() => element.rowElement(0)).toThrow(NotRightElementError);
        expect(() => element.rowElement(0)).toThrow("This is not a row, it's a input element");
      });
    });
  });

  describe('ActionLayoutPage', () => {
    it('should create a page with elements', () => {
      const pageLayout = {
        component: 'page',
        elements: [{ component: 'input', fieldId: 'name' }, { component: 'separator' }],
        nextButtonLabel: 'Next',
        previousButtonLabel: 'Back',
      } as any;

      const page = new ActionLayoutPage(pageLayout);

      expect(page.nextButtonLabel).toBe('Next');
      expect(page.previousButtonLabel).toBe('Back');
    });

    it('should throw error when layout is not a page', () => {
      const nonPageLayout = { component: 'input', fieldId: 'test' } as any;

      expect(() => new ActionLayoutPage(nonPageLayout)).toThrow(NotRightElementError);
      expect(() => new ActionLayoutPage(nonPageLayout)).toThrow(
        "This is not a page, it's a input element",
      );
    });

    it('should access element from page', () => {
      const pageLayout = {
        component: 'page',
        elements: [{ component: 'input', fieldId: 'email' }],
        nextButtonLabel: 'Submit',
        previousButtonLabel: 'Cancel',
      } as any;

      const page = new ActionLayoutPage(pageLayout);
      const element = page.element(0);

      expect(element.isInput()).toBe(true);
      expect(element.getInputId()).toBe('email');
    });
  });

  describe('ActionLayoutRoot', () => {
    it('should return page at specified index', () => {
      const layout = [
        {
          component: 'page',
          elements: [{ component: 'input', fieldId: 'field1' }],
          nextButtonLabel: 'Next',
          previousButtonLabel: 'Back',
        },
        {
          component: 'page',
          elements: [{ component: 'input', fieldId: 'field2' }],
          nextButtonLabel: 'Submit',
          previousButtonLabel: 'Previous',
        },
      ] as any;

      const root = new ActionLayoutRoot(layout);
      const page = root.page(1);

      expect(page.nextButtonLabel).toBe('Submit');
    });

    it('should throw error when page index is out of bounds', () => {
      const layout = [
        {
          component: 'page',
          elements: [],
          nextButtonLabel: 'Next',
          previousButtonLabel: 'Back',
        },
      ] as any;

      const root = new ActionLayoutRoot(layout);

      expect(() => root.page(5)).toThrow(NotFoundElementError);
      expect(() => root.page(5)).toThrow('Element 5 not found');
    });

    it('should throw error when page index is negative', () => {
      const layout = [
        {
          component: 'page',
          elements: [],
          nextButtonLabel: 'Next',
          previousButtonLabel: 'Back',
        },
      ] as any;

      const root = new ActionLayoutRoot(layout);

      expect(() => root.page(-1)).toThrow(NotFoundElementError);
    });

    it('should throw error when element at index is not a page', () => {
      const layout = [
        { component: 'input', fieldId: 'test' },
        {
          component: 'page',
          elements: [],
          nextButtonLabel: 'Next',
          previousButtonLabel: 'Back',
        },
      ] as any;

      const root = new ActionLayoutRoot(layout);

      expect(() => root.page(0)).toThrow(NotRightElementError);
      expect(() => root.page(0)).toThrow("This is not a page, it's a input element");
    });

    describe('element', () => {
      it('should return element at specified index', () => {
        const layout = [{ component: 'input', fieldId: 'test' }, { component: 'separator' }] as any;

        const root = new ActionLayoutRoot(layout);
        const element = root.element(0);

        expect(element.isInput()).toBe(true);
      });

      it('should throw error when index is out of bounds', () => {
        const layout = [{ component: 'input', fieldId: 'test' }] as any;

        const root = new ActionLayoutRoot(layout);

        expect(() => root.element(5)).toThrow(NotFoundElementError);
      });

      it('should throw error when index is negative', () => {
        const layout = [{ component: 'input', fieldId: 'test' }] as any;

        const root = new ActionLayoutRoot(layout);

        expect(() => root.element(-1)).toThrow(NotFoundElementError);
      });

      it('should throw error when element at index is a page', () => {
        const layout = [
          {
            component: 'page',
            elements: [],
            nextButtonLabel: 'Next',
            previousButtonLabel: 'Back',
          },
        ] as any;

        const root = new ActionLayoutRoot(layout);

        expect(() => root.element(0)).toThrow(NotRightElementError);
        expect(() => root.element(0)).toThrow("This is not an element, it's a page element");
      });
    });

    describe('isPage', () => {
      it('should return true when element is a page', () => {
        const layout = [
          {
            component: 'page',
            elements: [],
            nextButtonLabel: 'Next',
            previousButtonLabel: 'Back',
          },
        ] as any;

        const root = new ActionLayoutRoot(layout);

        expect(root.isPage(0)).toBe(true);
      });

      it('should return false when element is not a page', () => {
        const layout = [{ component: 'input', fieldId: 'test' }] as any;

        const root = new ActionLayoutRoot(layout);

        expect(root.isPage(0)).toBe(false);
      });

      it('should return false for undefined element', () => {
        const layout = [] as any;

        const root = new ActionLayoutRoot(layout);

        expect(root.isPage(0)).toBe(false);
      });
    });
  });
});
