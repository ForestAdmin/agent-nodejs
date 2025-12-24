import type { CodeCustomizationDetails, Spinner } from '../types';

export default function displayCustomizationInfo(
  spinner: Spinner,
  details: CodeCustomizationDetails,
) {
  const { relativeDate, user } = details;

  spinner.warn('There is already deployed customization code on your project');
  spinner.info(`Last code pushed ${relativeDate}, by ${user.name} (${user.email})`);
}
