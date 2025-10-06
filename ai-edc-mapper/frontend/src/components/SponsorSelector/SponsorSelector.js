import React from 'react';
import { Select } from 'antd';

const SponsorSelector = ({ sponsors, selectedSponsor, setSelectedSponsor }) => (
  <Select
    style={{ width: 240, marginBottom: 16 }}
    placeholder="Select Sponsor"
    value={selectedSponsor}
    onChange={setSelectedSponsor}
  >
    {sponsors.map(s => (
      <Select.Option key={s} value={s}>{s}</Select.Option>
    ))}
  </Select>
);

export default SponsorSelector;
