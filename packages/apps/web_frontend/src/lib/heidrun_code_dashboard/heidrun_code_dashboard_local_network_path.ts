///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunCodeDashboardLocalNetworkPath — the address of the Heidrun Code Dashboard page that the Heidrun Code Dashboard server serves to the devices of the local network
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The path of the Heidrun Code Dashboard page on the Heidrun Code Dashboard server, the same as `PAGE_PATH` of the package `heidrun_code_dashboard_server`. The page at this
 * path starts only the read-only Heidrun Code Dashboard, with no Tauri bridge (issue 978).
 */
export const HEIDRUN_CODE_DASHBOARD_LOCAL_NETWORK_PATH = '/heidrun_code_dashboard';
