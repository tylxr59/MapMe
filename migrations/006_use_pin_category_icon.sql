UPDATE categories
SET icon_name = 'pin',
    updated_at = CURRENT_TIMESTAMP
WHERE icon_name = 'map-pin';
