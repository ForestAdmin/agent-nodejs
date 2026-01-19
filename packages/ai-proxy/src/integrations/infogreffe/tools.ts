import RemoteTool from '../../remote-tool';
import createAdvancedCompanySearchTool from './tools/advanced-company-search';
import createAssessCompanyRiskTool from './tools/assess-company-risk';
import createCheckCompanyRadiationTool from './tools/check-company-radiation';
import createFindRelatedCompaniesTool from './tools/find-related-companies';
import createGetCompanyDetailsTool from './tools/get-company-details';
import createGetFinancialIndicatorsTool from './tools/get-financial-indicators';
import createSearchNewCompaniesTool from './tools/search-new-companies';
import createSearchRadiatedCompaniesTool from './tools/search-radiated-companies';

export interface InfogreffeConfig {
  apiKey: string;
}

export default function getInfogreffeTools(config: InfogreffeConfig): RemoteTool[] {
  const headers: Record<string, string> = {
    Authorization: `Apikey ${config.apiKey}`,
  };

  return [
    createCheckCompanyRadiationTool(headers),
    createSearchRadiatedCompaniesTool(headers),
    createSearchNewCompaniesTool(headers),
    createGetCompanyDetailsTool(headers),
    createAssessCompanyRiskTool(headers),
    createGetFinancialIndicatorsTool(headers),
    createFindRelatedCompaniesTool(headers),
    createAdvancedCompanySearchTool(headers),
  ].map(
    tool =>
      new RemoteTool({
        sourceId: 'infogreffe',
        sourceType: 'server',
        tool,
      }),
  );
}
