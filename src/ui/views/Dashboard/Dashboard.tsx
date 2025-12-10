import React, { useEffect, useMemo, useState } from 'react';
import { Block, Cancel, CheckCircle, Error, List, Visibility } from '@material-ui/icons';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import CustomTabs, { TabItem } from '../../components/CustomTabs/CustomTabs';
import Danger from '../../components/Typography/Danger';
import Search from '../../components/Search/Search';
import { PushActionView } from '../../types';
import { getPushes } from '../../services/git-push';
import PushesTable from './components/PushesTable';

const PENDING_TAB = 1;
const tabs: TabItem[] = [
  {
    tabName: 'All',
    tabIcon: List,
  },
  {
    tabName: 'Pending',
    tabIcon: Visibility,
  },
  {
    tabName: 'Approved',
    tabIcon: CheckCircle,
  },
  {
    tabName: 'Canceled',
    tabIcon: Cancel,
  },
  {
    tabName: 'Rejected',
    tabIcon: Block,
  },
  {
    tabName: 'Error',
    tabIcon: Error,
  },
];

const getQueryForTab = (tabName: string): any => {
  switch (tabName) {
    case 'All':
      return {};
    case 'Pending':
      return { blocked: true, authorised: false, rejected: false, canceled: false };
    case 'Approved':
      return { authorised: true };
    case 'Canceled':
      return { authorized: false, rejected: false, canceled: true };
    case 'Rejected':
      return { authorised: false, rejected: true, canceled: false };
    case 'Error':
      return { error: true };
    default:
      return {};
  }
};

const Dashboard: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<number>(PENDING_TAB);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pushes, setPushes] = useState<PushActionView[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadPushes = async () => {
      setIsLoading(true);
      try {
        const query = getQueryForTab(tabs[currentTab].tabName);
        setPushes(await getPushes(query));
      } finally {
        setIsLoading(false);
      }
    };
    loadPushes();
  }, [currentTab]);

  const filteredPushes = useMemo(() => {
    if (!searchTerm) return pushes;
    const lowerCaseTerm = searchTerm.toLowerCase();
    return pushes.filter(
      (item) =>
        item.repo.toLowerCase().includes(lowerCaseTerm) ||
        item.commitTo?.toLowerCase().includes(lowerCaseTerm) ||
        item.commitData?.[0]?.message.toLowerCase().includes(lowerCaseTerm),
    );
  }, [pushes, searchTerm]);

  const onTab = (newTab: number) => {
    setCurrentTab(newTab);
  };

  const onSearch = (term: string) => setSearchTerm(term.trim());

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {errorMessage && <Danger>{errorMessage}</Danger>}
      {!errorMessage && (
        <GridContainer>
          <GridItem xs={12} sm={12} md={12}>
            <CustomTabs headerColor='primary' tabs={tabs} value={currentTab} onChange={onTab} />
            <Search onSearch={onSearch} />
            <PushesTable pushes={filteredPushes} />
          </GridItem>
        </GridContainer>
      )}
    </div>
  );
};

export default Dashboard;
