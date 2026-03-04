import Popper from '@material-ui/core/Popper';
import Paper from '@material-ui/core/Paper';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';
import {
  CheckIcon,
  ChevronDownIcon,
  CodeIcon,
  CopyIcon,
  TerminalIcon,
} from '@primer/octicons-react';
import React, { useState, useEffect } from 'react';
import { PopperPlacementType } from '@material-ui/core/Popper';
import Button from './Button';
import { Tabs, Tab } from '@material-ui/core';
import { getSSHConfig, SSHConfig } from '../../services/ssh';

interface CodeActionButtonProps {
  cloneURL: string;
}

const CodeActionButton: React.FC<CodeActionButtonProps> = ({ cloneURL }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [placement, setPlacement] = useState<PopperPlacementType>();
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const [sshConfig, setSshConfig] = useState<SSHConfig | null>(null);
  const [sshURL, setSSHURL] = useState<string>('');

  // Load SSH config on mount
  useEffect(() => {
    const loadSSHConfig = async () => {
      try {
        const config = await getSSHConfig();
        setSshConfig(config);

        // Calculate SSH URL from HTTPS URL
        if (config.enabled && cloneURL) {
          const url = new URL(cloneURL);
          const hostname = url.hostname; // proxy hostname
          const path = url.pathname.substring(1); // remove leading /
          // Keep full path including remote hostname (e.g., 'github.com/user/repo.git')
          // This matches HTTPS behavior and allows backend to extract hostname

          // For non-standard SSH ports, use ssh:// URL format
          // For standard port 22, use git@host:path format
          if (config.port !== 22) {
            setSSHURL(`ssh://git@${hostname}:${config.port}/${path}`);
          } else {
            setSSHURL(`git@${hostname}:${path}`);
          }
        }
      } catch (error) {
        console.error('Error loading SSH config:', error);
      }
    };
    loadSSHConfig();
  }, [cloneURL]);

  const handleClick =
    (newPlacement: PopperPlacementType) => (event: React.MouseEvent<HTMLElement>) => {
      setIsCopied(false);
      setAnchorEl(event.currentTarget);
      setOpen((prev) => placement !== newPlacement || !prev);
      setPlacement(newPlacement);
    };

  const handleClickAway = () => {
    setOpen(false);
  };

  const handleTabChange = (_event: React.ChangeEvent<unknown>, newValue: number) => {
    setSelectedTab(newValue);
    setIsCopied(false);
  };

  const currentURL = selectedTab === 0 ? cloneURL : sshURL;
  const currentCloneCommand =
    selectedTab === 0 ? `git clone ${cloneURL}` : `git clone -c core.sshCommand="ssh -A" ${sshURL}`;

  return (
    <>
      <Button
        color='success'
        style={{
          borderRadius: '5px',
          padding: '6px 10px 6px 10px',
          fontWeight: 'bold',
          boxSizing: 'border-box',
          whiteSpace: 'nowrap',
        }}
        onClick={handleClick('bottom-end')}
      >
        <CodeIcon size='small' verticalAlign='middle' />{' '}
        <span style={{ padding: '4px 10px' }}>Code</span>
        <ChevronDownIcon size='small' verticalAlign='text-top' />
      </Button>
      <Popper
        open={open}
        anchorEl={anchorEl}
        placement={placement}
        style={{
          border: '1px solid rgba(211, 211, 211, 0.3)',
          borderRadius: '5px',
          minWidth: '350px',
          maxWidth: '450px',
          zIndex: 99,
        }}
      >
        <ClickAwayListener onClickAway={handleClickAway}>
          <Paper>
            <div style={{ padding: '15px', gap: '5px' }}>
              <TerminalIcon size='small' verticalAlign='middle' />{' '}
              <span style={{ paddingLeft: '5px', fontSize: '14px', fontWeight: 'bold' }}>
                Clone
              </span>
              {/* Tabs for HTTPS/SSH */}
              {sshConfig?.enabled && (
                <Tabs
                  value={selectedTab}
                  onChange={handleTabChange}
                  indicatorColor='primary'
                  textColor='primary'
                  style={{ marginTop: '10px' }}
                >
                  <Tab label='HTTPS' style={{ minWidth: '80px', fontSize: '12px' }} />
                  <Tab label='SSH' style={{ minWidth: '80px', fontSize: '12px' }} />
                </Tabs>
              )}
              <div style={{ marginTop: '10px', maxWidth: '380px' }}>
                <div
                  style={{
                    padding: '3px 8px 3px 8px',
                    border: '1px solid gray',
                    borderRadius: '5px',
                    fontSize: '12px',
                    minHeight: '22px',
                  }}
                >
                  <span
                    style={{
                      float: 'left',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      width: '90%',
                    }}
                  >
                    {currentURL}
                  </span>
                  <span
                    style={{
                      float: 'right',
                    }}
                  >
                    {!isCopied && (
                      <span
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          navigator.clipboard.writeText(currentCloneCommand);
                          setIsCopied(true);
                        }}
                      >
                        <CopyIcon />
                      </span>
                    )}
                    {isCopied && (
                      <span style={{ color: 'green' }}>
                        <CheckIcon />
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: '5px' }}>
                <span style={{ fontWeight: 'lighter', fontSize: '12px', opacity: 0.9 }}>
                  {selectedTab === 0
                    ? 'Use Git and run this command in your IDE or Terminal 👍'
                    : 'The -A flag enables SSH agent forwarding for authentication 🔐'}
                </span>
              </div>
            </div>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </>
  );
};

export default CodeActionButton;
