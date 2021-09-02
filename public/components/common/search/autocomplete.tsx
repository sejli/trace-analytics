/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */
import './search.scss';
import React, { createElement, Fragment, useEffect, useRef, useState } from 'react';

import { autocomplete } from '@algolia/autocomplete-js';
import { IQueryBarProps } from './search';
import { getDataValueQuery } from './queries/data_queries';
import { RAW_QUERY } from '../../../../common/constants/explorer';

export function Autocomplete(props: IQueryBarProps) {
  const { query, handleQueryChange, handleQuerySearch, pplService, dslService } = props;

  console.log('autocomplete loaded')
  
  let currIndex = '';
  
  let currField = ''
  let currFieldType = '';
  
  let inFieldsCommaLoop = false;
  let nextWhere = 99999;
  let nextStats = '';
  let indexList: string[] = [];
 
  const fieldsFromBackend: [] = [];
  const indicesFromBackend: [] = [];
  
  const firstCommand = [
    { label: 'index' },
    { label: 'search' },
    { label: 'source' }
  ];
  
  const pipeCommands = [
    { label: 'dedup' },
    { label: 'eval' },
    { label: 'fields' },
    { label: 'head' },
    { label: 'rare' },
    { label: 'rename' },
    { label: 'sort' },
    { label: 'stats' },
    { label: 'top' },
    { label: 'where' },
  ];
  
  const statsCommands = [
    { label: 'count()' },
    { label: 'sum(' },
    { label: 'avg(' },
    { label: 'max(' },
    { label: 'min(' },
  ];
  
  const fillSuggestions = ( str: string, word: string, items: any ) => {
    const filteredList = items.filter(
      ({ label }) => label.startsWith(word) && word !== label
    )
    const suggestionList = []
    for (let i = 0; i < filteredList.length; i++ ) {
      suggestionList.push({
        label: str.substring(0, str.lastIndexOf(word)) + filteredList[i].label,
        input: str,
        suggestion: filteredList[i].label.substring(word.length),
        itemName: filteredList[i].label
      })
    }
    return suggestionList;
  }
  
  const getFirstPipe = async (str: string) => {
    const splittedModel = str.split(' ');
    const prefix = splittedModel[splittedModel.length - 1];
    getIndices();
    return fillSuggestions(str, prefix, firstCommand)
  }

  const getCommands = async (str: string) => {
    const splittedModel = str.split(' ');
    const prefix = splittedModel[splittedModel.length - 1];
    const itemSuggestions = pipeCommands.filter(
      ({ label }) => label.startsWith(prefix) && prefix !== label
    );
    return fillSuggestions(str, prefix, itemSuggestions)
  }
  
  // Function to grab suggestions
  const getSuggestions = async (str: string) => {
    // handleQueryChange(str, currIndex)
    // console.log('query in getSuggestions(): ', query)
    // console.log('currIndex: ', currIndex);
    // console.log('fieldsFromBackend', fieldsFromBackend)

    if (str === 'testing') {
      handleQueryChange(str, currIndex);
    }

    const splittedModel = str.split(' ');
    const prefix = splittedModel[splittedModel.length - 1];
    let itemSuggestions: any = [];
    const fullSuggestions: any = [];
  
    if (splittedModel.length === 1) {
      currField = ''
      currIndex = ''
      return getFirstPipe(str);
    }

    else if (splittedModel.length > 1) {
      if (splittedModel[splittedModel.length - 2] === '|') {
        inFieldsCommaLoop = false;
        nextWhere = 99999;
        currField = '';
        return fillSuggestions(str, prefix, pipeCommands);
      } else if (splittedModel[splittedModel.length - 2].includes(',')) {
        if (inFieldsCommaLoop) {
          return fillSuggestions(str, prefix, fieldsFromBackend)
        }
        return fullSuggestions;
      } else if (splittedModel[splittedModel.length - 2] === 'source' || splittedModel[splittedModel.length - 2] === 'index') {
        return [{ label: str + '=', input: str, suggestion: '=' }].filter(
          ({ label }) => label.startsWith(prefix) && prefix !== label
        );
      } else if (indexList.includes(splittedModel[splittedModel.length - 2])) {
        currIndex = splittedModel[splittedModel.length - 2];
        getFields();
        return [{ label: str + '|', input: str, suggestion: '|' }].filter(
          ({ label }) => label.startsWith(prefix) && prefix !== label
        );
      } else if (splittedModel[splittedModel.length - 2] === 'search') {
        return [
          { label: str + 'source', input: str, suggestion: 'search source'.substring(str.length) },
        ].filter(
          ({ label }) => label.startsWith(prefix) && prefix !== label
        );
      } else if (splittedModel[splittedModel.length - 2] === 'stats') {
        nextStats = 'fields';
        return fillSuggestions(str, prefix, statsCommands);
      }
      else if (nextStats === 'fields') {
        if (splittedModel[splittedModel.length - 2] !== 'count()'){
          itemSuggestions = fieldsFromBackend.filter(
            ({ label, type }) => label.startsWith(prefix) && prefix !== label && (type === 'float' || type === 'integer')
          );
          for (let i = 0; i < itemSuggestions.length; i++) {
            fullSuggestions.push({
              label: str.substring(0, str.lastIndexOf(prefix) - 1) + itemSuggestions[i].label + ')',
              input: str.substring(0, str.length - 1),
              suggestion: itemSuggestions[i].label.substring(prefix.length) + ')',
              itemName: itemSuggestions[i].label
            });
          }
          return fillSuggestions(str, prefix, itemSuggestions);
        }
        nextStats = 'by';
      }
      else if (splittedModel[splittedModel.length - 2] === 'fields') {
        inFieldsCommaLoop = true;
        return fillSuggestions(str, prefix, fieldsFromBackend);
      }
      else if (splittedModel[splittedModel.length - 2] === 'dedup') {
        return fillSuggestions(str, prefix, fieldsFromBackend);
      }
      else if (splittedModel[splittedModel.length - 2] === 'where') {
        nextWhere = splittedModel.length;
        return fillSuggestions(str, prefix, fieldsFromBackend);
      }
      else if (nextWhere + 1 === splittedModel.length) {
        fullSuggestions.push({
          label: str + '=', 
          input: str,
          suggestion: '=',
          item: '='
        })
        currField = splittedModel[splittedModel.length - 2];
        currFieldType = fieldsFromBackend.find( field => field.label === currField).type;
        return fullSuggestions.filter(
          ({ label }) => label.startsWith(prefix) && prefix !== label
        );
      }
      else if (nextWhere + 2 === splittedModel.length) {
        console.log('in nextWhere === value')
        console.log('currField: ', currField)
        console.log('currFieldType: ', currFieldType)
        // await getDataValues(currIndex, currField, currFieldType);
        return fillSuggestions(str, prefix, await getDataValues(currIndex, currField, currFieldType))
      }
      else if (nextWhere + 3 === splittedModel.length) {
        return [{label: str + '|', input: str, suggestion: '|'}].filter(
          ({ label }) => label.startsWith(prefix) && prefix !== label
        )
      }
      else if (splittedModel.length > 2 && splittedModel[splittedModel.length - 3] === 'source'
        || splittedModel[splittedModel.length - 3] === 'index') {
        return fillSuggestions(str, prefix, indicesFromBackend);
      } else if (inFieldsCommaLoop) {
        return [
          { label: str.substring(0, str.length - 1) + ',', input: str.substring(0, str.length - 1), suggestion: ',', item: ',' },
          { label: str + '|', input: str, suggestion: '|', item: ',' },
        ].filter(({ label }) => label.startsWith(prefix) && prefix !== label);
      }
      return pipeCommands.filter(
        ({ label }) => label.startsWith(prefix) && prefix !== label && prefix !== ''
      );
    }
  }

  const getIndices = async () => {
    if(indicesFromBackend.length === 0) {
      // console.log('getting indices')
      const indices = (await dslService.fetchIndices()).filter(
        ({ index }) => !index.startsWith('.')
      )
      for (let i = 0; i < indices.length; i++) {
        indicesFromBackend.push({
          label: indices[i].index
        });
        indexList.push(indices[i].index);
      }
    }
  }
  
  const getFields = async () => {
    console.log('fieldsFromBackend.length: ', fieldsFromBackend.length)
    console.log('currIndex: ', currIndex)
    if (fieldsFromBackend.length === 0 && currIndex !== '') {
      console.log('in getFields()')
      const res = await dslService.fetchFields(currIndex);
      console.log(res)
      for (let element in res?.[currIndex].mappings.properties) {
        if (res?.[currIndex].mappings.properties[element].type === 'keyword') {
          fieldsFromBackend.push({ label: element, type: 'string' });  
        }
        else {
        fieldsFromBackend.push({ label: element, type: res?.[currIndex].mappings.properties[element].type });
        }
      }
    }
  }
  
  const onItemSelect = async ({ setIsOpen, setQuery, item, setStatus }) => {
    console.log('onItemSelect() item: ', item);
    if (fieldsFromBackend.length === 0 && indexList.includes(item.itemName)){
      currIndex = item.itemName
      getFields();
    }
    // setIsOpen(false);
    setQuery(item.label + ' ');
    console.log('onItemSelect() item.label: ', item.label)
    setStatus('loading')
  };

  const getDataValues = async (index: string, field: string, fieldType: string) => {
    const res = (await dslService.fetch(getDataValueQuery(index, field))).aggregations.top_tags.buckets;
    const dataValuesFromBackend: [] = [];
    res.forEach( (e) => {
      if (fieldType === 'string'){
        dataValuesFromBackend.push({label: '"' + e.key + '"', doc_count: e.doc_count});
      }
      else if (fieldType === 'boolean') {
        if (e.key === 1) {
          dataValuesFromBackend.push({label: 'True', doc_count: e.doc_count});
        }
        else {
          dataValuesFromBackend.push({label: 'False', doc_count: e.doc_count});
        }
      }
      else if (fieldType !== 'geo_point'){
        dataValuesFromBackend.push({label: String(e.key), doc_count: e.doc_count});
      }
    })
    return dataValuesFromBackend;
  }

  useEffect(() => {
    const search = autocomplete({
      container: '#autocomplete',
      tagName: '#autocomplete',
      initialState: {
        query: props.query[RAW_QUERY]
      },
      openOnFocus: true,
      minLength: 0,
      placeholder: 'Enter PPL query to retrieve log, traces, and metrics',
      onStateChange: ({ state }) => {
        // if (state.query === 'source') {
        //   handleQueryChange(state.query)
        // }
        // if (state.status === 'loading') {
        //   console.log('state.status === loading')
        // }
        // handleQueryChange(state.query, 'opensearch_dashboards_sample_data_flights');
        console.log('onStateChange() state: ', state)
        console.log('onStateChange() query:', state.query)
        handleQueryChange(state.query, 'opensearch_dashboards_sample_data_flights')
      },
      onSubmit: ({ state }) => {
        console.log('=========================================================================================')
        console.log('hit enter')
        console.log('state.query: ', state.query)
        console.log('currIndex: ', currIndex)
        handleQueryChange(state.query, currIndex);
        console.log('query: ', query);
        console.log('props.query: ', props.query)
        handleQuerySearch();
        console.log('=========================================================================================')
      },
      getSources({ query }) {
        return [
          {
            getItems({ query, setIsOpen }) {
              console.log(query.split(' '))
              return getSuggestions(query);
            },
            tagName: 'test',
            onSelect: ({ setQuery, setIsOpen, item, state, setStatus }) => {
              onItemSelect({
                setIsOpen,
                setQuery,
                item,
                setStatus
              });
            },
            templates: {
              item({ item, createElement }) {
                return createElement('div', {
                  dangerouslySetInnerHTML: {
                    __html: `<div>
                      ${item.input}<span class=styling>${item.suggestion}</span>
                    </div>`,
                  },
                });
              },
            },
          },
        ];
      },
      ...props,
    });

    return () => {
      search.destroy();
    };
  }, []);

  return <div id="autocomplete" />;
}
