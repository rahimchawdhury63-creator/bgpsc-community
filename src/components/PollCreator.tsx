import { useState } from 'react';

interface PollCreatorProps {
  poll: any;
  onChange: (poll: any) => void;
}

export default function PollCreator({ poll, onChange }: PollCreatorProps) {
  const [enabled, setEnabled] = useState(!!poll);
  const [options, setOptions] = useState<string[]>(poll?.options || ['', '']);
  const [multiChoice, setMultiChoice] = useState(poll?.multiChoice || false);
  const [endTime, setEndTime] = useState(poll?.endTime || '');

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleToggle = (value: boolean) => {
    setEnabled(value);
    if (value) {
      onChange({ options: ['', ''], multiChoice: false, endTime: '' });
    } else {
      onChange(null);
    }
  };

  const handleSave = () => {
    const validOptions = options.filter(o => o.trim());
    if (validOptions.length >= 2) {
      onChange({ options: validOptions, multiChoice, endTime });
    }
  };

  if (!enabled) {
    return (
      <button onClick={() => handleToggle(true)} className="btn btn-outline">
        + Add Poll
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-3 dark:border-gray-700">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Poll</h3>
        <button onClick={() => handleToggle(false)} className="text-sm text-red-500">
          Remove
        </button>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {options.map((option, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="text"
              value={option}
              onChange={(e) => updateOption(idx, e.target.value)}
              placeholder={`Option ${idx + 1}`}
              className="input flex-1"
            />
            {options.length > 2 && (
              <button
                onClick={() => removeOption(idx)}
                className="btn btn-outline text-red-500"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <button onClick={addOption} className="btn btn-outline text-sm w-full">
            + Add Option
          </button>
        )}
      </div>

      {/* Multi-choice */}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={multiChoice}
          onChange={(e) => setMultiChoice(e.target.checked)}
          className="rounded"
        />
        <span className="text-sm">Allow multiple selections</span>
      </label>

      {/* End time */}
      <div>
        <label className="label text-sm">End Time (optional)</label>
        <input
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="input mt-1"
          min={new Date().toISOString().slice(0, 16)}
        />
      </div>

      <button onClick={handleSave} className="btn btn-primary w-full">
        Save Poll
      </button>
    </div>
  );
}
