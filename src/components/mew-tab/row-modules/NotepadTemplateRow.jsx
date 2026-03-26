import React, {useCallback, useEffect, useState} from 'react';
import styles from '../mew-tab.css';
import {createTextSegment, normalizeTemplateValue} from './utils/notepadTemplateValue';

const createItemId = () => `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeListItems = value => {
    if (Array.isArray(value?.listItems)) {
        return value.listItems.map(item => {
            if (item && typeof item === 'object') {
                return {
                    id: String(item.id || createItemId()),
                    content: typeof item.content === 'string' ? item.content : ''
                };
            }

            return {
                id: createItemId(),
                content: String(item || '')
            };
        });
    }

    return [];
};

const toNextTemplateValue = (currentValue, listItems) => {
    const normalized = normalizeTemplateValue(currentValue);

    return {
        ...normalized,
        listItems,
        // Keep a plain text fallback so current runners still receive a stable template shape.
        segments: [createTextSegment(listItems.map(item => item.content).join('\n'))]
    };
};

const reorderListItems = (items, dragId, overId, insertAfter) => {
    const fromIndex = items.findIndex(item => item.id === dragId);
    const overIndex = items.findIndex(item => item.id === overId);

    if (fromIndex < 0 || overIndex < 0) return items;
    if (dragId === overId) return items;

    const nextItems = items.slice();
    const [dragged] = nextItems.splice(fromIndex, 1);

    let toIndex = overIndex;
    if (insertAfter) {
        toIndex += 1;
    }

    if (fromIndex < overIndex) {
        toIndex -= 1;
    }

    nextItems.splice(Math.max(0, Math.min(nextItems.length, toIndex)), 0, dragged);
    return nextItems;
};

const NotepadListCell = ({
    item,
    index,
    renderListCell,
    onDelete,
    onHandleDragStart,
    onHandleDragEnd,
    onCellDragOver,
    onCellDrop,
    isDragging,
    isDropBefore,
    isDropAfter
}) => {
    const classNames = [styles.notepadTemplateListCell];
    if (isDragging) classNames.push(styles.notepadTemplateListCellDragging);
    if (isDropBefore) classNames.push(styles.notepadTemplateListCellDropBefore);
    if (isDropAfter) classNames.push(styles.notepadTemplateListCellDropAfter);

    return (
        <div
            className={classNames.join(' ')}
            data-item-id={item.id}
            onDragOver={event => onCellDragOver(event, item.id)}
            onDrop={event => onCellDrop(event, item.id)}
        >
            <div className={styles.notepadTemplateCellControls}>
                <button
                    type="button"
                    draggable
                    className={styles.notepadTemplateDragHandle}
                    onDragStart={event => onHandleDragStart(event, item.id)}
                    onDragEnd={onHandleDragEnd}
                    aria-label="Reorder item"
                    title="Drag to reorder"
                >
                    <span className={styles.notepadTemplateDragHandleDots}>
                        <span className={styles.notepadTemplateDragHandleDot} />
                        <span className={styles.notepadTemplateDragHandleDot} />
                        <span className={styles.notepadTemplateDragHandleDot} />
                        <span className={styles.notepadTemplateDragHandleDot} />
                        <span className={styles.notepadTemplateDragHandleDot} />
                        <span className={styles.notepadTemplateDragHandleDot} />
                    </span>
                </button>

                <button
                    type="button"
                    className={styles.notepadTemplateDeleteButton}
                    onClick={() => onDelete(item.id)}
                    aria-label="Delete item"
                    title="Delete item"
                >
                    x
                </button>
            </div>

            <div className={styles.notepadTemplateListCellBody}>
                {typeof renderListCell === 'function' ? renderListCell({item, index}) : (
                    <div>
                        {item.id}
                    </div>
                )}
            </div>
        </div>
    );
};

const NotepadTemplateRow = ({
    placeholder = 'Write prompt text...',
    value,
    onChange,
    id,
    upstreamSources = [],
    renderListCell
}) => {
    const [listItems, setListItems] = useState(() => normalizeListItems(value));
    const [dragState, setDragState] = useState({
        dragId: null,
        overId: null,
        insertAfter: false
    });

    useEffect(() => {
        setListItems(normalizeListItems(value));
    }, [value]);

    const handleAddItem = useCallback(() => {
        const nextItems = listItems.concat([{id: createItemId(), content: ''}]);
        setListItems(nextItems);

        if (onChange) {
            onChange(toNextTemplateValue(value, nextItems));
        }
    }, [listItems, onChange, value]);

    const handleDeleteItem = useCallback(itemId => {
        const nextItems = listItems.filter(item => item.id !== itemId);
        setListItems(nextItems);

        if (onChange) {
            onChange(toNextTemplateValue(value, nextItems));
        }
    }, [listItems, onChange, value]);

    const handleHandleDragStart = useCallback((event, dragId) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', dragId);

        setDragState({
            dragId,
            overId: null,
            insertAfter: false
        });
    }, []);

    const handleHandleDragEnd = useCallback(() => {
        setDragState({
            dragId: null,
            overId: null,
            insertAfter: false
        });
    }, []);

    const handleCellDragOver = useCallback((event, overId) => {
        if (!dragState.dragId || dragState.dragId === overId) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        const rect = event.currentTarget.getBoundingClientRect();
        const insertAfter = event.clientY > rect.top + rect.height / 2;

        setDragState(prev => {
            if (prev.overId === overId && prev.insertAfter === insertAfter) return prev;

            return {
                ...prev,
                overId,
                insertAfter
            };
        });
    }, [dragState.dragId]);

    const handleCellDrop = useCallback((event, overId) => {
        event.preventDefault();

        const dragId = dragState.dragId || event.dataTransfer.getData('text/plain');
        if (!dragId || dragId === overId) {
            handleHandleDragEnd();
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const fallbackInsertAfter = event.clientY > rect.top + rect.height / 2;
        const insertAfter =
            dragState.overId === overId ? dragState.insertAfter : fallbackInsertAfter;

        const nextItems = reorderListItems(listItems, dragId, overId, insertAfter);
        setListItems(nextItems);

        if (onChange) {
            onChange(toNextTemplateValue(value, nextItems));
        }

        handleHandleDragEnd();
    }, [dragState, handleHandleDragEnd, listItems, onChange, value]);

    void placeholder;
    void upstreamSources;

    return (
        <div className={styles.notepadTemplateRow} data-id={id}>
            <div className={styles.notepadTemplateBoard}>
                {listItems.map((item, index) => (
                    <NotepadListCell
                        key={item.id}
                        item={item}
                        index={index}
                        renderListCell={renderListCell}
                        onDelete={handleDeleteItem}
                        onHandleDragStart={handleHandleDragStart}
                        onHandleDragEnd={handleHandleDragEnd}
                        onCellDragOver={handleCellDragOver}
                        onCellDrop={handleCellDrop}
                        isDragging={dragState.dragId === item.id}
                        isDropBefore={dragState.overId === item.id && !dragState.insertAfter}
                        isDropAfter={dragState.overId === item.id && dragState.insertAfter}
                    />
                ))}

                <button
                    type="button"
                    className={styles.notepadTemplateAddButton}
                    onClick={handleAddItem}
                    aria-label="Add list item"
                    title="Add list item"
                >
                    +
                </button>
            </div>
        </div>
    );
};

export default NotepadTemplateRow;