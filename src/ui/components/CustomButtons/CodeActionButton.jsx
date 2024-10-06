import Popper from '@mui/material/Popper';
import Paper from '@mui/material/Paper';
import {
  CheckIcon,
  ChevronDownIcon,
  CodeIcon,
  CopyIcon,
  TerminalIcon,
} from '@primer/octicons-react';
import React, { useState } from 'react';

const CodeActionButton = ({ cloneURL }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState();
  const [isCopied, setIsCopied] = useState(false);

  const handleClick = (newPlacement) => (event) => {
    setIsCopied(false);
    setAnchorEl(event.currentTarget);
    setOpen((prev) => placement !== newPlacement || !prev);
    setPlacement(newPlacement);
  };

  return (
    <>
      <span
        style={{
          background: '#2da44e',
          borderRadius: '5px',
          color: 'white',
          padding: '8px 10px 8px 10px',
          fontWeight: 'bold',
          cursor: 'pointer',
          border: '1px solid rgba(240,246,252,0.1)',
          whiteSpace: 'nowrap',
        }}
        onClick={handleClick('bottom-end')}
      >
        <CodeIcon size='small' verticalAlign='middle' />{' '}
        <span style={{ paddingLeft: '6px', paddingRight: '10px' }}>Code</span>
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
          <div style={{ padding: '15px', gap: '5px' }}>
            <TerminalIcon size='small' verticalAlign='middle' />{' '}
            <span style={{ paddingLeft: '5px', fontSize: '14px', fontWeight: 'bold' }}>Clone</span>
            <div style={{ marginTop: '5px', maxWidth: '299px' }}>
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
                  {cloneURL}
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
                        navigator.clipboard.writeText(`git clone ${cloneURL}`);
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
