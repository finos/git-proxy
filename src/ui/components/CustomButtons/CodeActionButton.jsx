import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Popper from '@material-ui/core/Popper';
import Paper from '@material-ui/core/Paper';
import {
  CheckIcon,
  ChevronDownIcon,
  CodeIcon,
  CopyIcon,
  TerminalIcon,
  KeyIcon,
} from '@primer/octicons-react';

const API_BASE = import.meta.env.VITE_API_URI ?? '';

const CodeActionButton = ({ cloneURL }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState();
  const [isCopied, setIsCopied] = useState(false);
  const [protocol, setProtocol] = useState('https');

  const [sshCfg, setSshCfg] = useState({ enabled: true, port: 22 });
  useEffect(() => {
    axios
      .get(`${API_BASE}/api/v1/config/ssh`, { withCredentials: true })
      .then((res) => {
        const { enabled = true, port = 22 } = res.data || {};
        setSshCfg({ enabled, port });
      })
      .catch((err) => {
        console.error('Failed to load SSH config:', err);
      });
  }, []);

  const getSSHUrl = () => {
    try {
      const urlObj = new URL(cloneURL);
      const host = urlObj.hostname; // hostname w/out any port
      let path = urlObj.pathname;
      if (path.startsWith('/')) path = path.slice(1);

      // Default port
      if (!sshCfg.port || sshCfg.port === 22) {
        return `git@${host}:${path}`;
      }
      // Custom port
      return `ssh://git@${host}:${sshCfg.port}/${path}`;
    } catch {
      return cloneURL;
    }
  };

  const selectedUrl = protocol === 'ssh' ? getSSHUrl() : cloneURL;

  const handleClick = (newPlacement) => (event) => {
    setIsCopied(false);
    setAnchorEl(event.currentTarget);
    setOpen((prev) => placement !== newPlacement || !prev);
    setPlacement(newPlacement);
  };

  const handleCopy = () => {
    const command = `git clone ${selectedUrl}`;
    navigator.clipboard.writeText(command);
    setIsCopied(true);
  };

  return (
    <>
      <span
        style={{
          background: '#2da44e',
          borderRadius: 5,
          color: 'white',
          padding: '8px 10px',
          fontWeight: 'bold',
          cursor: 'pointer',
          border: '1px solid rgba(240,246,252,0.1)',
          whiteSpace: 'nowrap',
          display: 'inline-flex',
          alignItems: 'center',
        }}
        onClick={handleClick('bottom-end')}
      >
        <CodeIcon size='small' verticalAlign='middle' />
        <span style={{ padding: '0 6px' }}>Clone</span>
        <ChevronDownIcon size='small' verticalAlign='text-top' />
      </span>

      <Popper
        open={open}
        anchorEl={anchorEl}
        placement={placement}
        style={{
          border: '1px solid rgba(211,211,211,0.3)',
          borderRadius: 5,
          minWidth: 300,
          maxWidth: 450,
          zIndex: 99,
        }}
      >
        <Paper>
          <div style={{ padding: '10px' }}>
            {/* Protocol tabs */}
            <div
              style={{ display: 'flex', borderBottom: '1px solid #e1e4e8', marginBottom: '10px' }}
            >
              <div
                onClick={() => {
                  setProtocol('https');
                  setIsCopied(false);
                }}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '6px 0',
                  cursor: 'pointer',
                  fontWeight: protocol === 'https' ? 'bold' : 'normal',
                  borderBottom:
                    protocol === 'https' ? '2px solid #2f81f7' : '2px solid transparent',
                }}
              >
                <TerminalIcon size='small' verticalAlign='middle' /> HTTPS
              </div>
              <div
                onClick={() => {
                  setProtocol('ssh');
                  setIsCopied(false);
                }}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '6px 0',
                  cursor: 'pointer',
                  fontWeight: protocol === 'ssh' ? 'bold' : 'normal',
                  borderBottom: protocol === 'ssh' ? '2px solid #2f81f7' : '2px solid transparent',
                }}
              >
                <KeyIcon size='small' verticalAlign='middle' /> SSH
              </div>
            </div>

            {/* Clone command box */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  border: '1px solid gray',
                  borderRadius: 5,
                  fontSize: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                git clone {selectedUrl}
              </div>
              <div style={{ marginLeft: 8 }}>
                {!isCopied ? (
                  <span style={{ cursor: 'pointer' }} onClick={handleCopy}>
                    <CopyIcon />
                  </span>
                ) : (
                  <span style={{ color: 'green' }}>
                    <CheckIcon />
                  </span>
                )}
              </div>
            </div>

            <div style={{ marginTop: '5px' }}>
              <span style={{ fontWeight: 'lighter', fontSize: '12px', opacity: 0.9 }}>
                Use Git and run this command in your IDE or Terminal 👍
              </span>
            </div>
          </div>
        </Paper>
      </Popper>
    </>
  );
};

export default CodeActionButton;
