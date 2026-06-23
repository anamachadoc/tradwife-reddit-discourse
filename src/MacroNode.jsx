import { Handle, Position } from '@xyflow/react';
import { memo, useContext } from 'react';
import { HighlightContext } from './highlight.js';

function MacroNode({ id, data }) {
  const { active, connected, pinned } = useContext(HighlightContext);
  const { label, lado } = data;
  const dim = active && connected && !connected.has(id);
  const sel = pinned === id;

  const cls = [
    'mcard',
    lado === 'interno' ? 'int' : 'ext',
    dim ? 'dim' : '',
    sel ? 'sel' : '',
  ].join(' ');

  return (
    <div className={cls}>
      <Handle type="target" position={Position.Top} className="rf-handle" isConnectable={false} />
      <Handle type="source" position={Position.Bottom} className="rf-handle" isConnectable={false} />
      <div className="mname">{label}</div>
    </div>
  );
}

export default memo(MacroNode);
