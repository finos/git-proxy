import React, { useState } from 'react';
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

const CodeActionButton = ({ cloneURL }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState();
  const [isCopied, setIsCopied] = useState(false);
  const [protocol, setProtocol] = useState('https');

  const getSSHUrl = () => {
    try {
      const urlObj = new URL(cloneURL);
      const host = urlObj.host;
      let path = urlObj.pathname;
      if (path.startsWith('/')) path = path.substring(1);
      return `git@${host}:${path}`;
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
          borderRadius: '5px',
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
          border: '1px solid rgba(211, 211, 211, 0.3)',
          borderRadius: '5px',
          minWidth: '300px',
          maxWidth: '450px',
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
                  borderRadius: '5px',
                  fontSize: '12px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                git clone {selectedUrl}
              </div>
              <div style={{ marginLeft: '8px' }}>
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
